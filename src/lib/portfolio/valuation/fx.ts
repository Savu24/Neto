import { D, type Dec, type DecInput } from "@/lib/money";
import type { DateKey } from "./dates";
import { lastOnOrBefore } from "./series";

export const BASE_CURRENCY = "PLN";

/** Kurs: ile złotych za 1 jednostkę waluty (tabela A NBP podaje kurs średni za 1 jednostkę). */
export interface FxPoint {
  readonly date: DateKey;
  readonly rate: DecInput;
}

/** Kursy według kodu waluty ISO 4217. PLN nie musi być w tabeli. */
export type FxTable = Readonly<Record<string, readonly FxPoint[]>>;

export interface FxResolved {
  rate: Dec;
  /** Data publikacji kursu; `null` dla waluty bazowej. */
  date: DateKey | null;
}

/** Kurs na dzień D = ostatni znany kurs z datą ≤ D (SPEC 7.2). `null`, gdy brak kursu. */
export function fxRateOn(table: FxTable, currency: string, date: DateKey): FxResolved | null {
  if (currency === BASE_CURRENCY) return { rate: D(1), date: null };
  const points = table[currency];
  if (!points) return null;
  const point = lastOnOrBefore(points, date);
  return point ? { rate: D(point.rate), date: point.date } : null;
}

export class MissingFxRateError extends Error {
  constructor(
    readonly currency: string,
    readonly date: DateKey,
  ) {
    super(`Brak kursu ${currency} na dzień ${date}`);
    this.name = "MissingFxRateError";
  }
}
