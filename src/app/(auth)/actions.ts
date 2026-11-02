"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/components/form";
import { getLocale, getT } from "@/i18n/server";
import { authDeps } from "@/lib/auth/deps";
import { verifyBotToken } from "@/lib/auth/external";
import { readPendingGoogle, clearPendingGoogle } from "@/lib/auth/google";
import { safeNext } from "@/lib/auth/paths";
import { requestMeta } from "@/lib/auth/request";
import {
  linkGoogleWithPassword,
  loginWithPassword,
  notifyLogin,
  registerUser,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  verifySecondFactor,
  type AuthError,
} from "@/lib/auth/service";
import {
  createSession,
  deleteSessionCookie,
  getSession,
  invalidateSession,
  setSessionCookie,
} from "@/lib/auth/session";
import { audit } from "@/lib/auth/audit";
import { emailAvailable } from "@/lib/email/send";

const str = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
};

async function errorText(error: AuthError | "bot_check", retryAfterSec?: number) {
  const t = await getT("auth");
  return t(`error_${error}`, { minutes: Math.max(1, Math.ceil((retryAfterSec ?? 60) / 60)) });
}

/** Po udanym uwierzytelnieniu: sesja, ciasteczko i przekierowanie (do 2FA, jeśli włączone). */
async function startSession(
  userId: string,
  opts: { needsTwoFactor: boolean; next: string; deletionCancelled: boolean },
): Promise<never> {
  const deps = authDeps();
  const meta = await requestMeta();
  const { token, session } = await createSession(userId, meta, { twoFactorVerified: !opts.needsTwoFactor });
  await setSessionCookie(token, meta.platform);
  const notice = opts.deletionCancelled ? "notice=deletion-cancelled" : "";
  if (opts.needsTwoFactor) {
    redirect(`/login/2fa?next=${encodeURIComponent(opts.next)}${notice ? `&${notice}` : ""}`);
  }
  await notifyLogin(deps, userId, session.id, meta);
  redirect(notice ? `${opts.next}${opts.next.includes("?") ? "&" : "?"}${notice}` : opts.next);
}

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const res = await loginWithPassword(
    authDeps(),
    { email: str(fd, "email"), password: str(fd, "password") },
    await requestMeta(),
  );
  if (!res.ok) return { error: await errorText(res.error, res.retryAfterSec) };
  return startSession(res.userId, {
    needsTwoFactor: res.needsTwoFactor,
    next: safeNext(str(fd, "next")),
    deletionCancelled: res.deletionCancelled,
  });
}

export async function twoFactorAction(_: FormState, fd: FormData): Promise<FormState> {
  const current = await getSession();
  if (!current) redirect("/login");
  const deps = authDeps();
  const meta = await requestMeta();
  const res = await verifySecondFactor(
    deps,
    { userId: current.user.id, sessionId: current.session.id, code: str(fd, "code") },
    meta,
  );
  if (!res.ok) return { error: await errorText(res.error, res.retryAfterSec) };
  await notifyLogin(deps, current.user.id, current.session.id, meta);
  redirect(safeNext(str(fd, "next")));
}

export async function registerAction(_: FormState, fd: FormData): Promise<FormState> {
  const meta = await requestMeta();
  if (!(await verifyBotToken(str(fd, "cf-turnstile-response") || null, meta.ip))) {
    return { error: await errorText("bot_check") };
  }
  const res = await registerUser(
    authDeps(),
    {
      email: str(fd, "email"),
      password: str(fd, "password"),
      name: str(fd, "name"),
      acceptTerms: fd.get("acceptTerms") === "on",
      locale: await getLocale(),
    },
    meta,
  );
  if (!res.ok) return { error: await errorText(res.error, res.retryAfterSec) };
  const { token } = await createSession(res.userId, meta, { twoFactorVerified: true });
  await setSessionCookie(token, meta.platform);
  redirect("/dashboard");
}

export async function forgotPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const t = await getT("auth");
  if (!emailAvailable()) return { error: t("forgotUnavailable") };
  await requestPasswordReset(authDeps(), str(fd, "email"), await requestMeta());
  return { message: t("forgotSent") };
}

export async function resetPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const res = await resetPassword(
    authDeps(),
    { token: str(fd, "token"), newPassword: str(fd, "password") },
    await requestMeta(),
  );
  if (!res.ok) return { error: await errorText(res.error) };
  redirect("/login?notice=reset-done");
}

export async function verifyEmailAction(_: FormState, fd: FormData): Promise<FormState> {
  const res = await verifyEmail(authDeps(), str(fd, "token"), await requestMeta());
  const t = await getT("auth");
  return res.ok ? { message: t("verifyDone") } : { error: t("verifyFailed") };
}

export async function googleLinkAction(_: FormState, fd: FormData): Promise<FormState> {
  const profile = await readPendingGoogle();
  if (!profile) redirect("/login");
  const res = await linkGoogleWithPassword(
    authDeps(),
    { profile, password: str(fd, "password") },
    await requestMeta(),
  );
  if (!res.ok) return { error: await errorText(res.error, res.retryAfterSec) };
  await clearPendingGoogle();
  return startSession(res.userId, {
    needsTwoFactor: res.needsTwoFactor,
    next: "/dashboard",
    deletionCancelled: res.deletionCancelled,
  });
}

export async function logoutAction() {
  const current = await getSession();
  if (current) {
    await invalidateSession(current.session.id);
    await audit(authDeps().db, "logout", { userId: current.user.id, meta: await requestMeta() });
  }
  await deleteSessionCookie();
  redirect("/login?notice=signed-out");
}
