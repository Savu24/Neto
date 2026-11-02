import type { Dec } from "@/lib/money";
import type { DateKey } from "@/lib/portfolio/valuation/dates";

/**
 * Interfejsy dostawców cen i kursów (SPEC 7.2, 14). Dostawcy zwracają notowania z datą dnia
 * (`YYYY-MM-DD`); zapis do `PriceSnapshot` / `FxRate` i wycena należą do warstwy wyżej.
 */

/** Instrument tak, jak opisuje go `Asset` w bazie. */
export interface InstrumentRef {
  readonly assetId: string;
  readonly currency: string;
  readonly symbol?: string;
  readonly isin?: string;
  /** Kod MIC giełdy, np. XWAR, XETR. */
  readonly exchange?: string;
  /** Identyfikator u dostawcy (`Asset.providerRef`). */
  readonly providerRef?: string;
  readonly priceSource: "PROVIDER" | "MANUAL";
}

export interface PriceQuote {
  readonly assetId: string;
  readonly date: DateKey;
  readonly close: Dec;
  readonly currency: string;
  readonly source: string;
}

export interface PriceProvider {
  readonly id: string;
  /** Ostatnia cena zamknięcia z datą ≤ `date` albo `null`. */
  getClose(instrument: InstrumentRef, date: DateKey): Promise<PriceQuote | null>;
  /** Ceny zamknięcia z dni notowań w [from, to], rosnąco po dacie. */
  getHistory(instrument: InstrumentRef, from: DateKey, to: DateKey): Promise<PriceQuote[]>;
}

export type FxTableKind = "A" | "B" | "MANUAL";

export interface FxQuote {
  readonly currency: string;
  /** Data publikacji kursu (dzień roboczy), nie dzień, na który go użyto. */
  readonly date: DateKey;
  /** PLN za 1 jednostkę waluty. */
  readonly ratePln: Dec;
  readonly table: FxTableKind;
  readonly source: string;
}

export interface FxProvider {
  readonly id: string;
  /** Kurs na dzień D = ostatni opublikowany kurs z datą ≤ D (weekendy i święta przenoszą kurs). */
  getRate(currency: string, date: DateKey): Promise<FxQuote | null>;
  /** Kursy opublikowane w [from, to], rosnąco po dacie. */
  getHistory(currency: string, from: DateKey, to: DateKey): Promise<FxQuote[]>;
}

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export class PricingError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PricingError";
  }
}
