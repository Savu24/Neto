import "server-only";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, dictionaries, negotiateLocale, type Locale, type Scope } from "./config";
import { createTranslator } from "./translate";

export async function getLocale(): Promise<Locale> {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  return negotiateLocale(cookieStore.get(LOCALE_COOKIE)?.value, headerList.get("accept-language"));
}

export async function getT<S extends Scope>(scope: S) {
  return createTranslator(await getLocale(), scope);
}

/** Słowniki wybranych zakresów do przekazania komponentom klienckim (tylko to, czego potrzebują). */
export function pickMessages<S extends Scope>(locale: Locale, scopes: readonly S[]) {
  return Object.fromEntries(scopes.map((s) => [s, dictionaries[locale][s]])) as Pick<
    (typeof dictionaries)[Locale],
    S
  >;
}
