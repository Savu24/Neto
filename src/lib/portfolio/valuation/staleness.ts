import { businessDaysBetween, type BusinessCalendar } from "./calendar";
import { daysBetween, type DateKey } from "./dates";

/**
 * Nieaktualne wyceny (SPEC 7.8):
 * - cena instrumentu rynkowego i kurs waluty: starsze niż 3 dni robocze względem D (wiek > 3);
 * - aktywo ręczne: brak aktualizacji przez 90 dni (wiek ≥ 90 dni kalendarzowych);
 * - saldo zobowiązania: brak aktualizacji przez 35 dni (wiek ≥ 35).
 * Dni robocze liczone kalendarzem "PL" (pon.–pt. bez polskich świąt), patrz `calendar.ts`.
 */
export type StaleKind = "price" | "fx" | "manual" | "liability";

export const STALE_THRESHOLDS: Readonly<
  Record<StaleKind, { unit: "businessDays" | "days"; limit: number; inclusive: boolean }>
> = {
  price: { unit: "businessDays", limit: 3, inclusive: false },
  fx: { unit: "businessDays", limit: 3, inclusive: false },
  manual: { unit: "days", limit: 90, inclusive: true },
  liability: { unit: "days", limit: 35, inclusive: true },
};

export interface Staleness {
  readonly kind: StaleKind;
  readonly sourceDate: DateKey;
  readonly asOf: DateKey;
  /** Wiek w jednostce progu (dni robocze albo kalendarzowe). */
  readonly age: number;
  readonly stale: boolean;
}

export function staleness(
  kind: StaleKind,
  sourceDate: DateKey,
  asOf: DateKey,
  calendar: BusinessCalendar = "PL",
): Staleness {
  const t = STALE_THRESHOLDS[kind];
  const age =
    t.unit === "businessDays"
      ? businessDaysBetween(sourceDate, asOf, calendar)
      : Math.max(0, daysBetween(sourceDate, asOf));
  return { kind, sourceDate, asOf, age, stale: t.inclusive ? age >= t.limit : age > t.limit };
}

export function isStale(kind: StaleKind, sourceDate: DateKey, asOf: DateKey): boolean {
  return staleness(kind, sourceDate, asOf).stale;
}
