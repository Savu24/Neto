import type { Locale } from "@/i18n/config";

/**
 * Formatowanie do wyświetlania. Liczby przychodzą jako string (Decimal z bazy) albo number;
 * Intl.NumberFormat przyjmuje string bez utraty precyzji. Strefa czasu dat: Europe/Warsaw (SPEC 7.1).
 */

export type Numeric = number | string | bigint;

const intlLocale: Record<Locale, string> = { pl: "pl-PL", en: "en-GB" };
const MINUS = "−";
const TIME_ZONE = "Europe/Warsaw";

function typographicMinus(s: string): string {
  return s.replace(/-/g, MINUS);
}

// Intl.NumberFormat przyjmuje napisy dziesiętne bez utraty precyzji (ES2023), typy TS jeszcze tego nie opisują.
const asIntl = (v: Numeric) => v as number;

export function formatMoney(
  value: Numeric,
  currency = "PLN",
  locale: Locale = "pl",
  opts: { signed?: boolean; fractionDigits?: number } = {},
): string {
  const digits = opts.fractionDigits ?? 2;
  const nf = new Intl.NumberFormat(intlLocale[locale], {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: opts.signed ? "exceptZero" : "auto",
  });
  return typographicMinus(nf.format(asIntl(value)));
}

/** Ułamek (0.1234) jako procent (12,34%). */
export function formatPercent(
  fraction: Numeric,
  locale: Locale = "pl",
  opts: { signed?: boolean; fractionDigits?: number } = {},
): string {
  const digits = opts.fractionDigits ?? 1;
  const nf = new Intl.NumberFormat(intlLocale[locale], {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: opts.signed ? "exceptZero" : "auto",
  });
  return typographicMinus(nf.format(asIntl(fraction)));
}

export function formatNumber(value: Numeric, locale: Locale = "pl", maxFractionDigits = 4): string {
  return typographicMinus(
    new Intl.NumberFormat(intlLocale[locale], { maximumFractionDigits: maxFractionDigits }).format(
      asIntl(value),
    ),
  );
}

export function formatDate(
  date: Date | string,
  locale: Locale = "pl",
  style: "short" | "long" = "short",
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(intlLocale[locale], {
    timeZone: TIME_ZONE,
    ...(style === "short"
      ? { day: "numeric", month: "numeric", year: "numeric" }
      : { day: "numeric", month: "long", year: "numeric" }),
  }).format(d);
}

/** Data dnia wyceny (YYYY-MM-DD) w strefie Europe/Warsaw dla podanej chwili. */
export function warsawDateKey(instant: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
  return parts;
}
