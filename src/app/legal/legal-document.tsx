import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/public";
import { ServiceWorkerRegistration } from "@/components/service-worker";
import { isLocale, locales, type Locale } from "@/i18n/config";
import { getLocale } from "@/i18n/server";
import { createTranslator } from "@/i18n/translate";
import {
  LEGAL_DRAFT,
  legalHref,
  legalTitleKey,
  loadLegalDocument,
  type LegalSlug,
} from "@/lib/legal/documents";
import { inlineText } from "@/lib/markdown/parse";
import { Markdown } from "@/lib/markdown/render";

/** Język dokumentu: `?lang=pl|en` (link do wersji językowej, np. dla App Store), inaczej język strony. */
async function documentLocale(lang: string | string[] | undefined): Promise<Locale> {
  return isLocale(lang) ? lang : getLocale();
}

export async function legalMetadata(slug: LegalSlug, lang: string | string[] | undefined): Promise<Metadata> {
  const t = createTranslator(await documentLocale(lang), "legal");
  const title = t(legalTitleKey[slug]);
  return {
    title,
    description: t("metaDescription", { title }),
    alternates: { canonical: legalHref(slug) },
    // Szkic nie trafia do wyszukiwarek, dopóki radca go nie zatwierdzi.
    robots: LEGAL_DRAFT ? { index: false, follow: true } : undefined,
  };
}

export async function LegalDocumentView({
  slug,
  lang,
}: {
  slug: LegalSlug;
  lang: string | string[] | undefined;
}) {
  const locale = await documentLocale(lang);
  const t = createTranslator(locale, "legal");
  const doc = await loadLegalDocument(slug, locale);
  const sections = doc.blocks.flatMap((b) =>
    b.type === "heading" && b.level === 2 ? [{ id: b.id, text: inlineText(b.children) }] : [],
  );

  return (
    <>
      <PublicHeader locale={locale} />
      <main lang={locale} className="mx-auto w-full max-w-[1120px] px-4 pt-6 lg:px-8 lg:pt-10">
        <div className="max-w-[72ch]">
          <nav aria-label={t("language")} className="flex gap-1 text-[13.5px]">
            {locales.map((l) => (
              <Link
                key={l}
                href={`${legalHref(slug)}?lang=${l}`}
                lang={l}
                aria-current={l === locale ? "true" : undefined}
                className="rounded-md px-2 py-1 text-ink-3 aria-[current]:bg-surface aria-[current]:font-semibold aria-[current]:text-ink"
              >
                {l === "pl" ? "Polski" : "English"}
              </Link>
            ))}
          </nav>

          {LEGAL_DRAFT ? (
            <aside
              className="mt-4 rounded-lg bg-warn-soft px-4 py-3 text-[14px]"
              aria-label={t("draftBadge")}
            >
              <strong className="font-semibold text-warn">{t("draftBadge")}</strong>
              <p className="mt-0.5 text-ink-2">{t("draftNotice")}</p>
            </aside>
          ) : null}

          <h1 className="mt-7 text-2xl font-semibold tracking-tight lg:text-[30px]">{doc.title}</h1>
          {locale === "en" ? <p className="mt-2 text-[13.5px] text-ink-3">{t("translationNotice")}</p> : null}

          {sections.length >= 4 ? (
            <nav aria-label={t("toc")} className="mt-6 border-y border-line py-4 text-[14px]">
              <p className="font-semibold">{t("toc")}</p>
              <ol className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="text-ink-2 hover:text-ink">
                      {s.text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}

          <article className="pb-4 text-[15px] leading-[1.6] [overflow-wrap:break-word]">
            <Markdown blocks={doc.blocks} />
          </article>
        </div>
      </main>
      <PublicFooter locale={locale} />
      <ServiceWorkerRegistration />
    </>
  );
}
