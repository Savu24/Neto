"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";

const YEAR = 60 * 60 * 24 * 365;
const cookieOptions = { maxAge: YEAR, sameSite: "lax" as const, path: "/" };

/** Preferencje (język) przed zalogowaniem trzymamy w ciasteczkach; od Etapu 4 także w profilu użytkownika. */
export async function setPreference(formData: FormData) {
  const store = await cookies();
  const locale = formData.get("locale");
  if (isLocale(locale)) store.set(LOCALE_COOKIE, locale, cookieOptions);
  revalidatePath("/", "layout");
}
