import { D, type DecInput } from "@/lib/money";
import type { DateKey } from "@/lib/portfolio/valuation/dates";
import { lastOnOrBefore, sortedByDate } from "@/lib/portfolio/valuation/series";
import type { FxProvider, FxQuote, InstrumentRef, PriceProvider, PriceQuote } from "./types";

/**
 * Dostawca ręczny: ceny i kursy wpisane przez użytkownika (aktualizacje wyceny, kurs z transakcji,
 * `FxRate` z tabelą MANUAL). Źródło danych podaje warstwa bazy jako funkcję, żeby moduł nie zależał od Prisma.
 */

export interface ManualPricePoint {
  readonly date: DateKey;
  readonly close: DecInput;
}

/** Wszystkie ręczne ceny instrumentu (kolejność dowolna). */
export type ManualPriceSource = (instrument: InstrumentRef) => Promise<readonly ManualPricePoint[]>;

export function createManualPriceProvider(source: ManualPriceSource): PriceProvider {
  const id = "manual";
  const toQuote = (instrument: InstrumentRef, p: ManualPricePoint): PriceQuote => ({
    assetId: instrument.assetId,
    date: p.date,
    close: D(p.close),
    currency: instrument.currency,
    source: id,
  });
  return {
    id,
    async getClose(instrument, date) {
      const point = lastOnOrBefore(await source(instrument), date);
      return point ? toQuote(instrument, point) : null;
    },
    async getHistory(instrument, from, to) {
      return sortedByDate(await source(instrument))
        .filter((p) => p.date >= from && p.date <= to)
        .map((p) => toQuote(instrument, p));
    },
  };
}

export interface ManualFxPoint {
  readonly date: DateKey;
  readonly rate: DecInput;
}

export type ManualFxSource = (currency: string) => Promise<readonly ManualFxPoint[]>;

export function createManualFxProvider(source: ManualFxSource): FxProvider {
  const id = "manual";
  const toQuote = (currency: string, p: ManualFxPoint): FxQuote => ({
    currency,
    date: p.date,
    ratePln: D(p.rate),
    table: "MANUAL",
    source: id,
  });
  return {
    id,
    async getRate(currency, date) {
      const point = lastOnOrBefore(await source(currency), date);
      return point ? toQuote(currency, point) : null;
    },
    async getHistory(currency, from, to) {
      return sortedByDate(await source(currency))
        .filter((p) => p.date >= from && p.date <= to)
        .map((p) => toQuote(currency, p));
    },
  };
}

/**
 * Kursy z kilku dostawców po kolei (np. NBP, potem ręczne dla walut spoza tabeli A):
 * pierwszy, który zwróci kurs, wygrywa. Błąd dostawcy przerywa (nie ukrywamy awarii NBP kursem ręcznym).
 */
export function chainFxProviders(providers: readonly FxProvider[]): FxProvider {
  return {
    id: providers.map((p) => p.id).join("+"),
    async getRate(currency, date) {
      for (const p of providers) {
        const quote = await p.getRate(currency, date);
        if (quote) return quote;
      }
      return null;
    },
    async getHistory(currency, from, to) {
      for (const p of providers) {
        const quotes = await p.getHistory(currency, from, to);
        if (quotes.length > 0) return quotes;
      }
      return [];
    },
  };
}
