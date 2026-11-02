import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Locale } from "@/i18n/config";
import { parseMarkdown, type Block } from "@/lib/markdown/parse";

/**
 * Dokumenty prawne renderowane z `docs/prawne/` (szkice z Etapu 12). Źródłem treści są pliki Markdown;
 * strona pokazuje tylko część publiczną: między pierwszą a drugą linią `---` (przed nią są pola
 * do uzupełnienia, po niej uwagi dla radcy). Informacja o ryzyku: tylko część B (wersja pełna).
 */

/** Dopóki radca nie zatwierdzi tekstów: oznaczenie „szkic”, noindex i brak w sitemapie. */
export const LEGAL_DRAFT = true;

export const legalSlugs = ["terms", "privacy", "cookies", "risk", "delete-account"] as const;
export type LegalSlug = (typeof legalSlugs)[number];

export function isLegalSlug(value: string): value is LegalSlug {
  return (legalSlugs as readonly string[]).includes(value);
}

/** Klucz tytułu w słowniku `legal`. */
export const legalTitleKey = {
  terms: "terms",
  privacy: "privacy",
  cookies: "cookies",
  risk: "risk",
  "delete-account": "deleteAccount",
} as const satisfies Record<LegalSlug, string>;

/** Adres publiczny. Usuwanie konta ma stały, krótki adres podawany w App Store Connect. */
export function legalHref(slug: LegalSlug): string {
  return slug === "delete-account" ? "/delete-account" : `/legal/${slug}`;
}

type Extract = { from?: RegExp; shiftHeadings?: number };

// Nazwy plików w docs/prawne/.
const SOURCES: Record<LegalSlug, Record<Locale, string> & Extract> = {
  terms: {
    pl: "regulamin.md",
    en: "regulamin.en.md",
  },
  privacy: {
    pl: "polityka-prywatnosci.md",
    en: "polityka-prywatnosci.en.md",
  },
  cookies: {
    pl: "polityka-cookies.md",
    en: "polityka-cookies.en.md",
  },
  risk: {
    pl: "ryzyko-i-brak-doradztwa.md",
    en: "ryzyko-i-brak-doradztwa.en.md",
    from: /^## B\./,
    shiftHeadings: -1,
  },
  "delete-account": {
    pl: "usuniecie-konta.md",
    en: "usuniecie-konta.en.md",
  },
};

export type LegalDocument = { title: string; blocks: Block[] };

/**
 * Część publiczna dokumentu: tytuł z pierwszego nagłówka `#` i treść.
 * Bez `from`: między pierwszą a następną linią `---`. Z `from`: od wiersza za pasującym nagłówkiem do końca.
 */
export function publicPart(markdown: string, opts: Extract = {}): { title: string; body: string } {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const title = (lines.find((l) => /^#\s/.test(l)) ?? "").replace(/^#\s+/, "").trim();
  let body: string[];
  if (opts.from) {
    const start = lines.findIndex((l) => opts.from!.test(l));
    body = start === -1 ? [] : lines.slice(start + 1);
  } else {
    const isRule = (l: string) => /^\s*---\s*$/.test(l);
    const start = lines.findIndex(isRule);
    const rest = start === -1 ? lines.filter((l) => !/^#\s/.test(l)) : lines.slice(start + 1);
    const end = rest.findIndex(isRule);
    body = end === -1 ? rest : rest.slice(0, end);
  }
  if (opts.shiftHeadings) {
    const shift = opts.shiftHeadings;
    body = body.map((l) =>
      l.replace(/^(#{1,6})(?=\s)/, (h) => "#".repeat(Math.min(6, Math.max(2, h.length + shift)))),
    );
  }
  return { title, body: body.join("\n").trim() };
}

export async function loadLegalDocument(slug: LegalSlug, locale: Locale): Promise<LegalDocument> {
  const source = SOURCES[slug];
  // Katalog wpisany dosłownie: śledzenie plików przy buildzie dołącza do serwera tylko docs/prawne/.
  const markdown = await readFile(path.join(process.cwd(), "docs", "prawne", source[locale]), "utf8");
  const { title, body } = publicPart(markdown, source);
  return { title, blocks: parseMarkdown(body) };
}
