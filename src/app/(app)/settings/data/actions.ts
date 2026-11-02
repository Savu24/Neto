"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/components/form";
import { getT } from "@/i18n/server";
import { authDeps } from "@/lib/auth/deps";
import { requestMeta } from "@/lib/auth/request";
import { requestAccountDeletion } from "@/lib/auth/service";
import { deleteSessionCookie, requireUser } from "@/lib/auth/session";

export async function deleteAccountAction(_: FormState, fd: FormData): Promise<FormState> {
  const { user } = await requireUser();
  const secret = fd.get("confirm");
  const value = typeof secret === "string" ? secret.trim() : "";
  // Sześć cyfr traktujemy jako kod TOTP, wszystko inne jako hasło.
  const input = /^\d{6}$/.test(value) ? { code: value } : { password: value };
  const res = await requestAccountDeletion(authDeps(), { userId: user.id, ...input }, await requestMeta());
  if (!res.ok) return { error: (await getT("auth"))("error_invalid_credentials") };
  await deleteSessionCookie();
  redirect("/login?notice=signed-out");
}
