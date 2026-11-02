import { Notice } from "@/components/form";
import { getT } from "@/i18n/server";

const NOTICES = {
  "deletion-cancelled": "deletionCancelled",
  "reset-done": "resetDone",
  "signed-out": "signedOut",
  "google-failed": "googleFailed",
} as const;

/** Komunikat po przekierowaniu (?notice=…). Tylko znane klucze, bez wstawiania tekstu z adresu. */
export async function RedirectNotice({ notice }: { notice: string | string[] | undefined }) {
  if (typeof notice !== "string" || !(notice in NOTICES)) return null;
  const t = await getT("auth");
  return <Notice>{t(NOTICES[notice as keyof typeof NOTICES])}</Notice>;
}
