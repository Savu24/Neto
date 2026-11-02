"use server";

import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import type { FormState } from "@/components/form";
import { getT } from "@/i18n/server";
import { audit } from "@/lib/auth/audit";
import { authDeps } from "@/lib/auth/deps";
import { requestMeta } from "@/lib/auth/request";
import {
  changePassword,
  confirmIdentity,
  confirmTotpSetup,
  disableTotp,
  replaceBackupCodes,
  sendVerificationEmail,
  startTotpSetup,
  type AuthError,
} from "@/lib/auth/service";
import { invalidateAllSessions, requireUser } from "@/lib/auth/session";
import { otpauthUri } from "@/lib/auth/totp";
import { scopedDb } from "@/lib/db/scoped";

const str = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
};

async function errorText(error: AuthError) {
  return (await getT("auth"))(`error_${error}`, { minutes: 15 });
}

export async function changePasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user, session } = await requireUser();
  const res = await changePassword(
    authDeps(),
    {
      userId: user.id,
      currentPassword: str(fd, "currentPassword"),
      newPassword: str(fd, "newPassword"),
      keepSessionId: session.id,
    },
    await requestMeta(),
  );
  if (!res.ok) return { error: await errorText(res.error) };
  revalidatePath("/settings/security");
  return { message: (await getT("settings"))("passwordChanged") };
}

export type TotpSetupState = { secret?: string; qrSvg?: string; backupCodes?: string[]; error?: string };

export async function startTotpAction(): Promise<TotpSetupState> {
  const { user } = await requireUser();
  const { secret } = await startTotpSetup(authDeps(), user.id);
  const qrSvg = await QRCode.toString(otpauthUri(secret, user.email), { type: "svg", margin: 1, width: 200 });
  return { secret, qrSvg };
}

export async function confirmTotpAction(prev: TotpSetupState, fd: FormData): Promise<TotpSetupState> {
  const { user } = await requireUser();
  const res = await confirmTotpSetup(
    authDeps(),
    { userId: user.id, code: str(fd, "code") },
    await requestMeta(),
  );
  if (!res.ok) return { ...prev, error: await errorText(res.error) };
  // Bez revalidatePath: strona przerysowałaby się w stanie „włączone” i kody zniknęłyby przed zapisaniem.
  return { backupCodes: res.backupCodes };
}

export async function disableTotpAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user } = await requireUser();
  const res = await disableTotp(
    authDeps(),
    { userId: user.id, password: str(fd, "password") },
    await requestMeta(),
  );
  if (!res.ok) return { error: await errorText(res.error) };
  revalidatePath("/settings/security");
  return { message: (await getT("settings"))("twoFactorOff") };
}

export async function regenerateCodesAction(
  _: { codes?: string[]; error?: string },
  fd: FormData,
): Promise<{ codes?: string[]; error?: string }> {
  const { user } = await requireUser();
  const deps = authDeps();
  if (!(await confirmIdentity(deps, { userId: user.id, password: str(fd, "password") }))) {
    return { error: await errorText("invalid_credentials") };
  }
  const codes = await replaceBackupCodes(deps, user.id);
  await audit(deps.db, "backup_codes_regenerated", { userId: user.id, meta: await requestMeta() });
  revalidatePath("/settings/security");
  return { codes };
}

export async function revokeSessionAction(fd: FormData) {
  const { user, session } = await requireUser();
  const id = str(fd, "sessionId");
  if (!id || id === session.id) return;
  const deps = authDeps();
  // scopedDb: można wylogować tylko własną sesję.
  await scopedDb(deps.db, user.id).session.deleteMany({ where: { id } });
  await audit(deps.db, "session_revoked", { userId: user.id, meta: await requestMeta() });
  revalidatePath("/settings/security");
}

export async function logoutAllAction() {
  const { user, session } = await requireUser();
  await invalidateAllSessions(user.id, { except: session.id });
  await audit(authDeps().db, "logout_all", { userId: user.id, meta: await requestMeta() });
  revalidatePath("/settings/security");
}

export async function resendVerificationAction(): Promise<FormState> {
  const { user } = await requireUser();
  await sendVerificationEmail(authDeps(), user.id);
  return { message: (await getT("settings"))("emailResent") };
}
