import { en, pl } from "./dictionaries";

export const locales = ["pl", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "pl";
export const LOCALE_COOKIE = "neto-locale";

export type Messages = typeof pl;
export type Scope = keyof Messages;
export type MessageKey<S extends Scope> = keyof Messages[S] & string;

export const dictionaries: Record<Locale, Messages> = { pl, en };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/** Kolejność: ciasteczko z ustawień, potem nagłówek Accept-Language, na końcu polski. */
export function negotiateLocale(cookieValue: string | undefined, acceptLanguage: string | null): Locale {
  if (isLocale(cookieValue)) return cookieValue;
  if (acceptLanguage) {
    const ranked = acceptLanguage
      .split(",")
      .map((part) => {
        const [tag, ...params] = part.trim().split(";");
        const q = params.find((p) => p.trim().startsWith("q="));
        return { lang: tag.toLowerCase().split("-")[0], q: q ? Number(q.trim().slice(2)) : 1 };
      })
      .filter((x) => x.lang && !Number.isNaN(x.q))
      .sort((a, b) => b.q - a.q);
    const match = ranked.find((x) => isLocale(x.lang));
    if (match) return match.lang as Locale;
  }
  return defaultLocale;
}
