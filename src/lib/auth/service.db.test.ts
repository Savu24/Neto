import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Email } from "@/lib/email/send";
import { resetDb, testDb } from "../../../tests/db";
import { decryptField } from "../crypto/fields";
import type { RequestMeta } from "./request";
import {
  changePassword,
  confirmTotpSetup,
  disableTotp,
  linkGoogleWithPassword,
  loginWithGoogle,
  loginWithPassword,
  purgeDeletedAccounts,
  registerUser,
  requestAccountDeletion,
  requestPasswordReset,
  resetPassword,
  startTotpSetup,
  verifyEmail,
  verifySecondFactor,
  type Deps,
} from "./service";
import { createSession, validateSessionToken } from "./session";
import { totp } from "./totp";

const db = testDb();
let outbox: Email[] = [];
let clock = new Date("2026-11-02T10:00:00Z");
const deps: Deps = {
  db,
  appUrl: "http://localhost:3000",
  mail: async (e) => {
    outbox.push(e);
    return { delivered: true };
  },
  now: () => clock,
  isPwned: async (p) => p === "haslo-z-wycieku-123",
};
const meta: RequestMeta = {
  ip: "203.0.113.7",
  ipPrefix: "203.0.113.0",
  userAgent: "Mozilla/5.0 Chrome/140",
  platform: "web",
};
const PASSWORD = "bardzo-dlugie-haslo-1";

const linkToken = (e: Email) => e.text.match(/token=([\w-]+)/)?.[1] ?? "";

async function register(email = "kasia@example.com") {
  const res = await registerUser(deps, { email, password: PASSWORD, acceptTerms: true }, meta);
  if (!res.ok) throw new Error(res.error);
  return res.userId;
}

beforeEach(async () => {
  await resetDb(db);
  outbox = [];
  clock = new Date("2026-11-02T10:00:00Z");
});
afterAll(() => db.$disconnect());

describe("rejestracja i weryfikacja e-maila", () => {
  it("zakłada konto, haszuje hasło i wysyła link weryfikacyjny", async () => {
    const userId = await register("  Kasia@Example.com ");
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.email).toBe("kasia@example.com");
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.termsAcceptedAt).not.toBeNull();
    expect(outbox).toHaveLength(1);
    expect(outbox[0].subject).toContain("Potwierdź");

    expect((await verifyEmail(deps, linkToken(outbox[0]), meta)).ok).toBe(true);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).emailVerified).not.toBeNull();
    // drugi raz ten sam link nie działa
    expect(await verifyEmail(deps, linkToken(outbox[0]), meta)).toEqual({
      ok: false,
      error: "invalid_token",
    });
  });

  it("odrzuca krótkie hasło, hasło z wycieku, brak zgody i zajęty e-mail", async () => {
    const base = { email: "a@example.com", acceptTerms: true };
    expect(await registerUser(deps, { ...base, password: "krotkie" }, meta)).toMatchObject({
      error: "password_too_short",
    });
    expect(await registerUser(deps, { ...base, password: "haslo-z-wycieku-123" }, meta)).toMatchObject({
      error: "password_pwned",
    });
    expect(await registerUser(deps, { ...base, password: PASSWORD, acceptTerms: false }, meta)).toMatchObject(
      {
        error: "terms_required",
      },
    );
    expect(await registerUser(deps, { ...base, email: "zly-adres", password: PASSWORD }, meta)).toMatchObject(
      {
        error: "invalid_email",
      },
    );
    await register("a@example.com");
    expect(await registerUser(deps, { ...base, password: PASSWORD }, meta)).toMatchObject({
      error: "email_taken",
    });
  });

  it("link weryfikacyjny wygasa po 24 h", async () => {
    await register();
    clock = new Date(clock.getTime() + 25 * 60 * 60 * 1000);
    expect(await verifyEmail(deps, linkToken(outbox[0]), meta)).toEqual({
      ok: false,
      error: "invalid_token",
    });
  });
});

describe("logowanie", () => {
  it("poprawne hasło loguje, złe nie zdradza, czy konto istnieje", async () => {
    const userId = await register();
    expect(
      await loginWithPassword(deps, { email: "KASIA@example.com", password: PASSWORD }, meta),
    ).toMatchObject({
      ok: true,
      userId,
      needsTwoFactor: false,
    });
    const wrong = await loginWithPassword(
      deps,
      { email: "kasia@example.com", password: "zle-haslo-xxxxx" },
      meta,
    );
    const missing = await loginWithPassword(
      deps,
      { email: "nikt@example.com", password: "zle-haslo-xxxxx" },
      meta,
    );
    expect(wrong).toEqual({ ok: false, error: "invalid_credentials" });
    expect(missing).toEqual(wrong);
    expect(await db.auditLog.count({ where: { event: "login_failed" } })).toBe(2);
  });

  it("blokuje po 5 nieudanych próbach na konto i odblokowuje po 15 minutach", async () => {
    await register();
    for (let i = 0; i < 5; i++) {
      await loginWithPassword(deps, { email: "kasia@example.com", password: "zle-haslo-xxxxx" }, meta);
    }
    const blocked = await loginWithPassword(deps, { email: "kasia@example.com", password: PASSWORD }, meta);
    expect(blocked).toMatchObject({ ok: false, error: "rate_limited" });
    clock = new Date(clock.getTime() + 16 * 60 * 1000);
    expect(
      await loginWithPassword(deps, { email: "kasia@example.com", password: PASSWORD }, meta),
    ).toMatchObject({
      ok: true,
    });
  });
});

describe("weryfikacja dwuetapowa", () => {
  it("włączenie wymaga poprawnego kodu, daje 10 kodów zapasowych i jednorazowe ich użycie", async () => {
    const userId = await register();
    const { secret } = await startTotpSetup(deps, userId);
    const stored = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(stored.totpSecretEnc).not.toContain(secret);
    expect(decryptField(stored.totpSecretEnc!)).toBe(secret);

    expect(await confirmTotpSetup(deps, { userId, code: "000000" }, meta)).toMatchObject({
      error: "invalid_code",
    });
    const confirmed = await confirmTotpSetup(deps, { userId, code: totp(secret, clock.getTime()) }, meta);
    if (!confirmed.ok) throw new Error(confirmed.error);
    expect(confirmed.backupCodes).toHaveLength(10);
    expect(new Set(confirmed.backupCodes).size).toBe(10);

    const login = await loginWithPassword(deps, { email: "kasia@example.com", password: PASSWORD }, meta);
    expect(login).toMatchObject({ ok: true, needsTwoFactor: true });
    const { token, session } = await createSession(userId, meta, { twoFactorVerified: false }, db);
    expect((await validateSessionToken(token, db))?.session.twoFactorVerified).toBe(false);

    expect(
      await verifySecondFactor(deps, { userId, sessionId: session.id, code: "123456" }, meta),
    ).toMatchObject({
      error: "invalid_code",
    });
    const backup = confirmed.backupCodes[0].toUpperCase();
    expect(
      await verifySecondFactor(deps, { userId, sessionId: session.id, code: backup }, meta),
    ).toMatchObject({
      ok: true,
      usedBackupCode: true,
    });
    expect((await validateSessionToken(token, db))?.session.twoFactorVerified).toBe(true);
    // ten sam kod zapasowy drugi raz nie działa
    const s2 = await createSession(userId, meta, { twoFactorVerified: false }, db);
    expect(
      await verifySecondFactor(deps, { userId, sessionId: s2.session.id, code: backup }, meta),
    ).toMatchObject({
      error: "invalid_code",
    });
    expect(
      await verifySecondFactor(
        deps,
        { userId, sessionId: s2.session.id, code: totp(secret, clock.getTime()) },
        meta,
      ),
    ).toMatchObject({ ok: true, usedBackupCode: false });
  });

  it("wyłączenie wymaga hasła i usuwa sekret oraz kody", async () => {
    const userId = await register();
    const { secret } = await startTotpSetup(deps, userId);
    await confirmTotpSetup(deps, { userId, code: totp(secret, clock.getTime()) }, meta);
    expect(await disableTotp(deps, { userId, password: "zle" }, meta)).toMatchObject({
      error: "invalid_credentials",
    });
    expect(await disableTotp(deps, { userId, password: PASSWORD }, meta)).toEqual({ ok: true });
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.totpEnabledAt).toBeNull();
    expect(user.totpSecretEnc).toBeNull();
    expect(await db.backupCode.count({ where: { userId } })).toBe(0);
  });
});

describe("hasło", () => {
  it("zmiana hasła wylogowuje inne sesje, zostawia bieżącą", async () => {
    const userId = await register();
    const current = await createSession(userId, meta, { twoFactorVerified: true }, db);
    const other = await createSession(userId, meta, { twoFactorVerified: true }, db);
    expect(
      await changePassword(
        deps,
        {
          userId,
          currentPassword: "zle",
          newPassword: "nowe-dlugie-haslo-2",
          keepSessionId: current.session.id,
        },
        meta,
      ),
    ).toMatchObject({ error: "invalid_credentials" });
    expect(
      await changePassword(
        deps,
        {
          userId,
          currentPassword: PASSWORD,
          newPassword: "nowe-dlugie-haslo-2",
          keepSessionId: current.session.id,
        },
        meta,
      ),
    ).toEqual({ ok: true });
    expect(await validateSessionToken(current.token, db)).not.toBeNull();
    expect(await validateSessionToken(other.token, db)).toBeNull();
  });

  it("reset hasła: ta sama odpowiedź dla nieznanego e-maila, link jednorazowy, wylogowanie wszystkich", async () => {
    const userId = await register();
    outbox = [];
    expect(await requestPasswordReset(deps, "nikt@example.com", meta)).toEqual({ ok: true });
    expect(outbox).toHaveLength(0);
    expect(await requestPasswordReset(deps, "kasia@example.com", meta)).toEqual({ ok: true });
    const token = linkToken(outbox[0]);
    const s = await createSession(userId, meta, { twoFactorVerified: true }, db);
    expect(await resetPassword(deps, { token, newPassword: "nowe-dlugie-haslo-3" }, meta)).toMatchObject({
      ok: true,
    });
    expect(await validateSessionToken(s.token, db)).toBeNull();
    expect(await resetPassword(deps, { token, newPassword: "nowe-dlugie-haslo-4" }, meta)).toMatchObject({
      error: "invalid_token",
    });
    expect(
      await loginWithPassword(deps, { email: "kasia@example.com", password: "nowe-dlugie-haslo-3" }, meta),
    ).toMatchObject({
      ok: true,
    });
  });
});

describe("Google", () => {
  const profile = { sub: "google-123", email: "nowa@example.com", emailVerified: true, name: "Nowa" };

  it("nowy e-mail zakłada konto, drugi raz loguje to samo konto", async () => {
    const first = await loginWithGoogle(deps, profile, meta);
    expect(first).toMatchObject({ ok: true, created: true });
    const second = await loginWithGoogle(deps, profile, meta);
    expect(second).toMatchObject({ ok: true, created: false });
    if (first.ok && second.ok) expect(second.userId).toBe(first.userId);
  });

  it("istniejące konto z hasłem wymaga potwierdzenia hasłem przed połączeniem", async () => {
    const userId = await register("kasia@example.com");
    const p = { ...profile, email: "kasia@example.com" };
    expect(await loginWithGoogle(deps, p, meta)).toMatchObject({ error: "google_link_requires_password" });
    expect(
      await linkGoogleWithPassword(deps, { profile: p, password: "zle-haslo-xxxxx" }, meta),
    ).toMatchObject({
      error: "invalid_credentials",
    });
    expect(await linkGoogleWithPassword(deps, { profile: p, password: PASSWORD }, meta)).toMatchObject({
      ok: true,
      userId,
    });
    expect(await loginWithGoogle(deps, p, meta)).toMatchObject({ ok: true, userId });
  });

  it("niezweryfikowany e-mail z Google jest odrzucany", async () => {
    expect(await loginWithGoogle(deps, { ...profile, emailVerified: false }, meta)).toMatchObject({
      error: "invalid_email",
    });
  });
});

describe("usunięcie konta", () => {
  it("karencja 14 dni, logowanie anuluje, po terminie dane znikają kaskadowo", async () => {
    const userId = await register();
    await db.financialAccount.create({
      data: { userId, name: "Konto", kind: "ASSET", type: "CASH", currency: "PLN" },
    });
    await createSession(userId, meta, { twoFactorVerified: true }, db);

    expect(await requestAccountDeletion(deps, { userId, password: "zle" }, meta)).toMatchObject({
      error: "invalid_credentials",
    });
    expect(await requestAccountDeletion(deps, { userId, password: PASSWORD }, meta)).toMatchObject({
      ok: true,
    });
    expect(await db.session.count({ where: { userId } })).toBe(0);

    // logowanie w karencji anuluje
    clock = new Date(clock.getTime() + 3 * 24 * 60 * 60 * 1000);
    expect(
      await loginWithPassword(deps, { email: "kasia@example.com", password: PASSWORD }, meta),
    ).toMatchObject({
      deletionCancelled: true,
    });
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).deletionRequestedAt).toBeNull();

    // ponowne zgłoszenie i czyszczenie po 14 dniach
    await requestAccountDeletion(deps, { userId, password: PASSWORD }, meta);
    clock = new Date(clock.getTime() + 13 * 24 * 60 * 60 * 1000);
    expect(await purgeDeletedAccounts(deps)).toBe(0);
    clock = new Date(clock.getTime() + 2 * 24 * 60 * 60 * 1000);
    expect(await purgeDeletedAccounts(deps)).toBe(1);
    expect(await db.user.count()).toBe(0);
    expect(await db.financialAccount.count()).toBe(0);
    // ślad w dzienniku bezpieczeństwa zostaje, bez powiązania z kontem
    expect(await db.auditLog.count({ where: { event: "account_deletion_requested" } })).toBe(2);
  });
});
