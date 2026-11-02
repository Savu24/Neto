import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import { getLocale } from "@/i18n/server";
import { createTranslator } from "@/i18n/translate";
import { legalHref, legalSlugs, legalTitleKey } from "@/lib/legal/documents";

/** Nagłówek stron publicznych: znak i wejście do aplikacji. `locale` nadpisuje język strony (dokumenty z ?lang). */
export async function PublicHeader({ locale }: { locale?: Locale } = {}) {
  const t = createTranslator(locale ?? (await getLocale()), "marketing");
  return (
    <header className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-4 px-4 pt-5 pb-3 lg:px-8">
      <Link href="/" className="text-[22px] font-bold tracking-tight text-brand">
        Neto
      </Link>
      <nav className="flex items-center gap-1 text-[14.5px]">
        <Link href="/login" className="rounded-[10px] px-3 py-2 font-medium text-ink-2 hover:text-ink">
          {t("signIn")}
        </Link>
        <Link href="/register" className="rounded-[10px] bg-brand px-3.5 py-2 font-semibold text-on-brand">
          {t("signUp")}
        </Link>
      </nav>
    </header>
  );
}

/** Stopka stron publicznych: wszystkie dokumenty prawne pod stałymi adresami. */
export async function PublicFooter({ locale }: { locale?: Locale } = {}) {
  const lang = locale ?? (await getLocale());
  const [t, tl] = [createTranslator(lang, "marketing"), createTranslator(lang, "legal")];
  return (
    <footer className="mx-auto mt-16 w-full max-w-[1120px] border-t border-line px-4 pt-6 pb-10 text-[13.5px] text-ink-3 lg:px-8">
      <nav aria-label={t("footerLegal")}>
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {legalSlugs.map((slug) => (
            <li key={slug}>
              <Link href={legalHref(slug)} className="hover:text-ink">
                {tl(legalTitleKey[slug])}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </footer>
  );
}

/** Wstawia element (zwykle link) w miejsce `{link}` w tekście ze słownika. */
export function withLink(text: string, link: ReactNode): ReactNode {
  return text.split("{link}").map((part, i) => (
    <Fragment key={i}>
      {i > 0 ? link : null}
      {part}
    </Fragment>
  ));
}
