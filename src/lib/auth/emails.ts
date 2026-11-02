import { isLocale, type Locale } from "@/i18n/config";
import { createTranslator, type Params } from "@/i18n/translate";
import type { Email } from "@/lib/email/send";

export type AuthEmailKind =
  | "verify"
  | "reset"
  | "newDevice"
  | "passwordChanged"
  | "totpEnabled"
  | "totpDisabled"
  | "deletionRequested"
  | "deletionCancelled";

/** E-maile konta w języku użytkownika. Bez kwot i danych finansowych. */
export function authEmail(locale: string, kind: AuthEmailKind, params: Params, to: string): Email {
  const t = createTranslator(isLocale(locale) ? (locale as Locale) : "pl", "email");
  return {
    to,
    subject: t(`${kind}Subject`),
    text: `${t(`${kind}Body`, params)}\n\n— Neto`,
  };
}
