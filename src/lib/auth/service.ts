import "server-only";
import { createHash } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { decryptField, encryptField } from "@/lib/crypto/fields";
import type { Mailer } from "@/lib/email/send";
import { audit } from "./audit";
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  generateBackupCode,
  hashPassword,
  normalizeBackupCode,
  normalizeEmail,
  verifyPassword,
} from "./crypto";
import { authEmail } from "./emails";
import { LIMITS, consume, rateKey, resetLimit } from "./rate-limit";
import type { RequestMeta } from "./request";
import { createToken, consumeToken } from "./tokens";
import { generateTotpSecret, verifyTotp } from "./totp";

/**
 * Logika konta niezależna od Next.js (testowana na prawdziwej bazie w service.db.test.ts).
 * Akcje serwera w src/app/(auth) tylko wołają te funkcje i ustawiają ciasteczka.
 */

export type AuthError =
  | "invalid_email"
  | "invalid_credentials"
  | "rate_limited"
  | "email_taken"
  | "password_too_short"
  | "password_too_long"
  | "password_pwned"
  | "terms_required"
  | "invalid_code"
  | "invalid_token"
  | "totp_not_pending"
  | "google_link_requires_password";

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: AuthError; retryAfterSec?: number };

export type Deps = {
  db: PrismaClient;
  mail: Mailer;
  appUrl: string;
  now?: () => Date;
  /** Sprawdzenie hasła w bazie wycieków; null = funkcja wyłączona. */
  isPwned?: ((password: string) => Promise<boolean>) | null;
};

export const DELETION_GRACE_DAYS = 14;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Porównanie z prawdziwym skrótem także wtedy, gdy konto nie istnieje: wyrównuje czas odpowiedzi.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword("neto-dummy-password-for-timing"));

const now = (deps: Deps) => (deps.now ? deps.now() : new Date());

async function checkPassword(deps: Deps, password: string): Promise<AuthError | null> {
  if (password.length < PASSWORD_MIN) return "password_too_short";
  if (password.length > PASSWORD_MAX) return "password_too_long";
  if (deps.isPwned && (await deps.isPwned(password))) return "password_pwned";
  return null;
}

// ---------- Rejestracja ----------

export async function registerUser(
  deps: Deps,
  input: { email: string; password: string; name?: string; acceptTerms: boolean; locale?: "pl" | "en" },
  meta: RequestMeta,
): Promise<Result<{ userId: string }>> {
  const email = normalizeEmail(input.email);
  if (!EMAIL_RE.test(email) || email.length > 254) return { ok: false, error: "invalid_email" };
  if (!input.acceptTerms) return { ok: false, error: "terms_required" };
  const limited = await consume(
    deps.db,
    rateKey("register", meta.ip ?? "unknown"),
    LIMITS.register,
    now(deps),
  );
  if (!limited.ok) return { ok: false, error: "rate_limited", retryAfterSec: limited.retryAfterSec };
  const pwError = await checkPassword(deps, input.password);
  if (pwError) return { ok: false, error: pwError };
  if (await deps.db.user.findUnique({ where: { email }, select: { id: true } })) {
    return { ok: false, error: "email_taken" };
  }
  const user = await deps.db.user.create({
    data: {
      email,
      name: input.name?.trim() || null,
      passwordHash: await hashPassword(input.password),
      locale: input.locale ?? "pl",
      termsAcceptedAt: now(deps),
    },
  });
  await audit(deps.db, "register", { userId: user.id, meta });
  await sendVerificationEmail(deps, user.id);
  return { ok: true, userId: user.id };
}

export async function sendVerificationEmail(deps: Deps, userId: string) {
  const user = await deps.db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.emailVerified) return;
  const token = await createToken(deps.db, "verify-email", user.id, now(deps));
  await deps.mail(
    authEmail(user.locale, "verify", { link: `${deps.appUrl}/verify-email?token=${token}` }, user.email),
  );
}

export async function verifyEmail(deps: Deps, token: string, meta: RequestMeta): Promise<Result> {
  const userId = await consumeToken(deps.db, "verify-email", token, now(deps));
  if (!userId) return { ok: false, error: "invalid_token" };
  await deps.db.user.update({ where: { id: userId }, data: { emailVerified: now(deps) } });
  await audit(deps.db, "email_verified", { userId, meta });
  return { ok: true };
}

// ---------- Logowanie ----------

export type LoginOk = { userId: string; needsTwoFactor: boolean; deletionCancelled: boolean };

export async function loginWithPassword(
  deps: Deps,
  input: { email: string; password: string },
  meta: RequestMeta,
): Promise<Result<LoginOk>> {
  const email = normalizeEmail(input.email);
  const t = now(deps);
  const byIp = await consume(deps.db, rateKey("loginIp", meta.ip ?? "unknown"), LIMITS.loginIp, t);
  const emailKey = rateKey("loginEmail", email);
  const byEmail = await consume(deps.db, emailKey, LIMITS.loginEmail, t);
  if (!byIp.ok || !byEmail.ok) {
    const retryAfterSec = Math.max(byIp.ok ? 0 : byIp.retryAfterSec, byEmail.ok ? 0 : byEmail.retryAfterSec);
    return { ok: false, error: "rate_limited", retryAfterSec };
  }

  const user = await deps.db.user.findUnique({ where: { email } });
  const valid = await verifyPassword(
    user?.passwordHash ?? (await getDummyHash()),
    input.password.slice(0, PASSWORD_MAX),
  );
  if (!user || !user.passwordHash || !valid) {
    await audit(deps.db, "login_failed", { userId: user?.id ?? null, meta });
    return { ok: false, error: "invalid_credentials" };
  }
  await resetLimit(deps.db, emailKey);
  const deletionCancelled = await cancelDeletionIfPending(deps, user.id, meta);
  return { ok: true, userId: user.id, needsTwoFactor: Boolean(user.totpEnabledAt), deletionCancelled };
}

/** Logowanie w okresie karencji anuluje usunięcie konta (SPEC HU-1.6). */
async function cancelDeletionIfPending(deps: Deps, userId: string, meta: RequestMeta) {
  const user = await deps.db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.deletionRequestedAt) return false;
  await deps.db.user.update({ where: { id: userId }, data: { deletionRequestedAt: null } });
  await audit(deps.db, "account_deletion_cancelled", { userId, meta });
  await deps.mail(authEmail(user.locale, "deletionCancelled", {}, user.email));
  return true;
}

/** Po udanym logowaniu: e-mail o nowym urządzeniu, jeśli to pierwsza sesja z tej przeglądarki/aplikacji. */
export async function notifyLogin(deps: Deps, userId: string, sessionId: string, meta: RequestMeta) {
  await audit(deps.db, "login", { userId, meta, data: { platform: meta.platform } });
  const known = await deps.db.session.count({
    where: { userId, id: { not: sessionId }, userAgent: meta.userAgent ?? undefined },
  });
  if (known > 0) return;
  const user = await deps.db.user.findUniqueOrThrow({ where: { id: userId } });
  await deps.mail(
    authEmail(
      user.locale,
      "newDevice",
      { device: describeDevice(meta.userAgent), ip: meta.ipPrefix ?? "?" },
      user.email,
    ),
  );
}

export function describeDevice(ua: string | null): string {
  if (!ua) return "?";
  if (ua.includes("NetoApp-iOS")) return "Neto iOS";
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "";
  return [browser, os].filter(Boolean).join(", ") || "?";
}

// ---------- 2FA ----------

export async function verifySecondFactor(
  deps: Deps,
  input: { userId: string; sessionId: string; code: string },
  meta: RequestMeta,
): Promise<Result<{ usedBackupCode: boolean }>> {
  const limited = await consume(deps.db, rateKey("twoFactor", input.userId), LIMITS.twoFactor, now(deps));
  if (!limited.ok) return { ok: false, error: "rate_limited", retryAfterSec: limited.retryAfterSec };

  const user = await deps.db.user.findUniqueOrThrow({ where: { id: input.userId } });
  if (!user.totpEnabledAt || !user.totpSecretEnc) return { ok: false, error: "invalid_code" };

  let usedBackupCode = false;
  const step = verifyTotp(decryptField(user.totpSecretEnc), input.code, now(deps).getTime());
  if (step === null) {
    usedBackupCode = await consumeBackupCode(deps, user.id, input.code);
    if (!usedBackupCode) {
      await audit(deps.db, "login_2fa_failed", { userId: user.id, meta });
      return { ok: false, error: "invalid_code" };
    }
    await audit(deps.db, "backup_code_used", { userId: user.id, meta });
  }
  await deps.db.session.update({ where: { id: input.sessionId }, data: { twoFactorVerified: true } });
  await resetLimit(deps.db, rateKey("twoFactor", input.userId));
  return { ok: true, usedBackupCode };
}

function hashBackupCode(code: string) {
  return createHash("sha256")
    .update(`neto-backup:${normalizeBackupCode(code)}`)
    .digest("hex");
}

async function consumeBackupCode(deps: Deps, userId: string, code: string) {
  const res = await deps.db.backupCode.updateMany({
    where: { userId, codeHash: hashBackupCode(code), usedAt: null },
    data: { usedAt: now(deps) },
  });
  return res.count === 1;
}

/** Krok 1 włączania 2FA: nowy sekret zapisany zaszyfrowany, nieaktywny do potwierdzenia kodem. */
export async function startTotpSetup(deps: Deps, userId: string): Promise<{ secret: string }> {
  const secret = generateTotpSecret();
  await deps.db.user.update({
    where: { id: userId, totpEnabledAt: null },
    data: { totpSecretEnc: encryptField(secret) },
  });
  return { secret };
}

export async function confirmTotpSetup(
  deps: Deps,
  input: { userId: string; code: string },
  meta: RequestMeta,
): Promise<Result<{ backupCodes: string[] }>> {
  const user = await deps.db.user.findUniqueOrThrow({ where: { id: input.userId } });
  if (user.totpEnabledAt || !user.totpSecretEnc) return { ok: false, error: "totp_not_pending" };
  if (verifyTotp(decryptField(user.totpSecretEnc), input.code, now(deps).getTime()) === null) {
    return { ok: false, error: "invalid_code" };
  }
  await deps.db.user.update({ where: { id: user.id }, data: { totpEnabledAt: now(deps) } });
  const backupCodes = await replaceBackupCodes(deps, user.id);
  await audit(deps.db, "totp_enabled", { userId: user.id, meta });
  await deps.mail(authEmail(user.locale, "totpEnabled", {}, user.email));
  return { ok: true, backupCodes };
}

export async function replaceBackupCodes(deps: Deps, userId: string): Promise<string[]> {
  const codes = Array.from({ length: 10 }, generateBackupCode);
  await deps.db.$transaction([
    deps.db.backupCode.deleteMany({ where: { userId } }),
    deps.db.backupCode.createMany({ data: codes.map((c) => ({ userId, codeHash: hashBackupCode(c) })) }),
  ]);
  return codes;
}

/** Wyłączenie 2FA wymaga hasła (albo, dla kont tylko z Google, kodu 2FA). */
export async function disableTotp(
  deps: Deps,
  input: { userId: string; password?: string; code?: string },
  meta: RequestMeta,
): Promise<Result> {
  if (!(await confirmIdentity(deps, input))) return { ok: false, error: "invalid_credentials" };
  const user = await deps.db.user.update({
    where: { id: input.userId },
    data: { totpEnabledAt: null, totpSecretEnc: null },
  });
  await deps.db.backupCode.deleteMany({ where: { userId: user.id } });
  await audit(deps.db, "totp_disabled", { userId: user.id, meta });
  await deps.mail(authEmail(user.locale, "totpDisabled", {}, user.email));
  return { ok: true };
}

/** Potwierdzenie tożsamości przy operacjach wrażliwych: hasło albo kod TOTP. */
export async function confirmIdentity(
  deps: Deps,
  input: { userId: string; password?: string; code?: string },
) {
  const user = await deps.db.user.findUniqueOrThrow({ where: { id: input.userId } });
  if (input.password && user.passwordHash) return verifyPassword(user.passwordHash, input.password);
  if (input.code && user.totpEnabledAt && user.totpSecretEnc) {
    return verifyTotp(decryptField(user.totpSecretEnc), input.code, now(deps).getTime()) !== null;
  }
  return false;
}

// ---------- Hasło ----------

export async function changePassword(
  deps: Deps,
  input: { userId: string; currentPassword: string; newPassword: string; keepSessionId: string },
  meta: RequestMeta,
): Promise<Result> {
  const user = await deps.db.user.findUniqueOrThrow({ where: { id: input.userId } });
  if (user.passwordHash && !(await verifyPassword(user.passwordHash, input.currentPassword))) {
    return { ok: false, error: "invalid_credentials" };
  }
  const pwError = await checkPassword(deps, input.newPassword);
  if (pwError) return { ok: false, error: pwError };
  await deps.db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(input.newPassword) },
  });
  await deps.db.session.deleteMany({ where: { userId: user.id, id: { not: input.keepSessionId } } });
  await audit(deps.db, "password_changed", { userId: user.id, meta });
  await deps.mail(authEmail(user.locale, "passwordChanged", {}, user.email));
  return { ok: true };
}

/** Zawsze ta sama odpowiedź, niezależnie od tego, czy konto istnieje (SPEC HU-1.4). */
export async function requestPasswordReset(deps: Deps, rawEmail: string, meta: RequestMeta): Promise<Result> {
  const email = normalizeEmail(rawEmail);
  const limited = await consume(deps.db, rateKey("reset", email), LIMITS.reset, now(deps));
  if (!limited.ok) return { ok: true };
  const user = await deps.db.user.findUnique({ where: { email } });
  if (!user) return { ok: true };
  const token = await createToken(deps.db, "reset-password", user.id, now(deps));
  await audit(deps.db, "password_reset_requested", { userId: user.id, meta });
  await deps.mail(
    authEmail(user.locale, "reset", { link: `${deps.appUrl}/reset-password?token=${token}` }, user.email),
  );
  return { ok: true };
}

export async function resetPassword(
  deps: Deps,
  input: { token: string; newPassword: string },
  meta: RequestMeta,
): Promise<Result<{ userId: string }>> {
  const pwError = await checkPassword(deps, input.newPassword);
  if (pwError) return { ok: false, error: pwError };
  const userId = await consumeToken(deps.db, "reset-password", input.token, now(deps));
  if (!userId) return { ok: false, error: "invalid_token" };
  const user = await deps.db.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(input.newPassword), emailVerified: now(deps) },
  });
  await deps.db.session.deleteMany({ where: { userId } });
  await audit(deps.db, "password_reset", { userId, meta });
  await deps.mail(authEmail(user.locale, "passwordChanged", {}, user.email));
  return { ok: true, userId };
}

// ---------- Google ----------

export type GoogleProfile = { sub: string; email: string; emailVerified: boolean; name?: string };

/**
 * Logowanie Google: znane konto Google → ten użytkownik; nowy e-mail → nowe konto;
 * e-mail istniejącego konta z hasłem → wymaga potwierdzenia hasłem (SPEC HU-1.2), bez automatycznego łączenia.
 */
export async function loginWithGoogle(
  deps: Deps,
  profile: GoogleProfile,
  meta: RequestMeta,
): Promise<Result<LoginOk & { created: boolean }>> {
  const linked = await deps.db.account.findUnique({
    where: { provider_providerAccountId: { provider: "google", providerAccountId: profile.sub } },
  });
  if (linked) {
    const user = await deps.db.user.findUniqueOrThrow({ where: { id: linked.userId } });
    const deletionCancelled = await cancelDeletionIfPending(deps, user.id, meta);
    return {
      ok: true,
      userId: user.id,
      needsTwoFactor: Boolean(user.totpEnabledAt),
      deletionCancelled,
      created: false,
    };
  }
  const email = normalizeEmail(profile.email);
  if (!profile.emailVerified) return { ok: false, error: "invalid_email" };
  const existing = await deps.db.user.findUnique({ where: { email } });
  if (existing) return { ok: false, error: "google_link_requires_password" };

  const user = await deps.db.user.create({
    data: {
      email,
      name: profile.name ?? null,
      emailVerified: now(deps),
      termsAcceptedAt: now(deps),
      accounts: { create: { type: "oidc", provider: "google", providerAccountId: profile.sub } },
    },
  });
  await audit(deps.db, "register", { userId: user.id, meta, data: { provider: "google" } });
  return { ok: true, userId: user.id, needsTwoFactor: false, deletionCancelled: false, created: true };
}

/** Połączenie Google z istniejącym kontem po podaniu hasła. */
export async function linkGoogleWithPassword(
  deps: Deps,
  input: { profile: GoogleProfile; password: string },
  meta: RequestMeta,
): Promise<Result<LoginOk>> {
  const login = await loginWithPassword(deps, { email: input.profile.email, password: input.password }, meta);
  if (!login.ok) return login;
  await deps.db.account.create({
    data: { userId: login.userId, type: "oidc", provider: "google", providerAccountId: input.profile.sub },
  });
  await audit(deps.db, "google_linked", { userId: login.userId, meta });
  return login;
}

// ---------- Usunięcie konta ----------

export async function requestAccountDeletion(
  deps: Deps,
  input: { userId: string; password?: string; code?: string },
  meta: RequestMeta,
): Promise<Result<{ purgeAfter: Date }>> {
  if (!(await confirmIdentity(deps, input))) return { ok: false, error: "invalid_credentials" };
  const at = now(deps);
  const user = await deps.db.user.update({ where: { id: input.userId }, data: { deletionRequestedAt: at } });
  await deps.db.session.deleteMany({ where: { userId: user.id } });
  const purgeAfter = new Date(at.getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
  await audit(deps.db, "account_deletion_requested", { userId: user.id, meta });
  await deps.mail(
    authEmail(user.locale, "deletionRequested", { date: purgeAfter.toISOString().slice(0, 10) }, user.email),
  );
  return { ok: true, purgeAfter };
}

/** Zadanie cykliczne: twarde usunięcie kont po karencji. Dane finansowe znikają kaskadowo. */
export async function purgeDeletedAccounts(deps: Pick<Deps, "db" | "now">): Promise<number> {
  const cutoff = new Date(now(deps as Deps).getTime() - DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
  const res = await deps.db.user.deleteMany({ where: { deletionRequestedAt: { lte: cutoff } } });
  return res.count;
}
