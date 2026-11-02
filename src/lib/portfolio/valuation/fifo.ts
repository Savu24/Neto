import { D, ZERO, type Dec, type DecInput } from "@/lib/money";
import type { DateKey } from "./dates";
import { BASE_CURRENCY, fxRateOn, MissingFxRateError, type FxTable } from "./fx";
import { lastIndexOnOrBefore, memoByArray, sortedByDate } from "./series";

/**
 * Partie i koszt nabycia metodą FIFO (SPEC 7.6).
 *
 * - Prowizja kupna wchodzi w koszt partii; prowizja sprzedaży pomniejsza przychód.
 *   Prowizja jest w walucie instrumentu (tak jak cena).
 * - Kurs transakcji: `fxRate` z transakcji (np. faktyczny kurs brokera, SPEC 7.2), inaczej kurs z tabeli
 *   na dzień transakcji (ostatni ≤ D), dla instrumentu w PLN zawsze 1.
 * - Tego samego dnia najpierw kupna, potem sprzedaże: przy FIFO wynik jest ten sam, a sprzedaż
 *   akcji kupionych rano nie kończy się błędem braku ilości.
 */

export type TradeType = "BUY" | "SELL";

export interface TradeInput {
  readonly id?: string;
  readonly type: TradeType;
  readonly date: DateKey;
  /** Liczba jednostek, dodatnia. */
  readonly quantity: DecInput;
  /** Cena jednostkowa w walucie instrumentu. */
  readonly price: DecInput;
  /** Prowizja w walucie instrumentu. */
  readonly fee?: DecInput;
  /** PLN za 1 jednostkę waluty instrumentu; nadpisuje kurs z tabeli. */
  readonly fxRate?: DecInput;
}

export interface Lot {
  readonly tradeId?: string;
  readonly openedAt: DateKey;
  readonly quantity: Dec;
  readonly remaining: Dec;
  /** Koszt jednostkowy w walucie instrumentu, z prowizją. */
  readonly unitCost: Dec;
  readonly fxRate: Dec;
}

export interface RealizedSale {
  readonly tradeId?: string;
  readonly date: DateKey;
  readonly quantity: Dec;
  /** Przychód po prowizji, waluta instrumentu. */
  readonly proceeds: Dec;
  readonly proceedsPln: Dec;
  readonly cost: Dec;
  readonly costPln: Dec;
  /** Wynik zrealizowany w walucie instrumentu. */
  readonly realized: Dec;
  /** Wynik zrealizowany w PLN (przychód po kursie sprzedaży − koszt po kursach zakupu). */
  readonly realizedPln: Dec;
}

export interface FifoResult {
  readonly lots: readonly Lot[];
  readonly sales: readonly RealizedSale[];
}

export interface FifoOptions {
  /** Waluta instrumentu. */
  readonly currency: string;
  readonly fx?: FxTable;
  /** Uwzględnij tylko transakcje z datą ≤ upTo. */
  readonly upTo?: DateKey;
}

export class InsufficientQuantityError extends Error {
  constructor(
    readonly date: DateKey,
    readonly requested: Dec,
    readonly available: Dec,
    readonly tradeId?: string,
  ) {
    super(`Sprzedaż ${requested.toFixed()} szt. z dnia ${date}: dostępne ${available.toFixed()} szt.`);
    this.name = "InsufficientQuantityError";
  }
}

export function lotCost(lot: Lot): Dec {
  return lot.remaining.times(lot.unitCost);
}

export function lotCostPln(lot: Lot): Dec {
  return lot.remaining.times(lot.unitCost).times(lot.fxRate);
}

function tradeFxRate(trade: TradeInput, opts: FifoOptions): Dec {
  if (trade.fxRate !== undefined) return D(trade.fxRate);
  if (opts.currency === BASE_CURRENCY) return D(1);
  const resolved = opts.fx ? fxRateOn(opts.fx, opts.currency, trade.date) : null;
  if (!resolved) throw new MissingFxRateError(opts.currency, trade.date);
  return resolved.rate;
}

/** Kolejność przetwarzania: data rosnąco, w obrębie dnia kupna przed sprzedażami, dalej kolejność wejścia. */
export function orderTrades<T extends TradeInput>(trades: readonly T[]): T[] {
  const sorted = sortedByDate(trades);
  const rank = (t: TradeInput) => (t.type === "BUY" ? 0 : 1);
  return [...sorted].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : rank(a) - rank(b)));
}

export function applyFifo(trades: readonly TradeInput[], opts: FifoOptions): FifoResult {
  type MutableLot = { -readonly [K in keyof Lot]: Lot[K] };
  const lots: MutableLot[] = [];
  const sales: RealizedSale[] = [];

  for (const trade of orderTrades(trades)) {
    if (opts.upTo !== undefined && trade.date > opts.upTo) break;
    const quantity = D(trade.quantity);
    if (quantity.lte(0)) throw new RangeError(`Ilość w transakcji z dnia ${trade.date} musi być dodatnia`);
    const price = D(trade.price);
    const fee = D(trade.fee ?? 0);
    const fxRate = tradeFxRate(trade, opts);

    if (trade.type === "BUY") {
      lots.push({
        tradeId: trade.id,
        openedAt: trade.date,
        quantity,
        remaining: quantity,
        unitCost: quantity.times(price).plus(fee).div(quantity),
        fxRate,
      });
      continue;
    }

    const available = lots.reduce((acc, l) => acc.plus(l.remaining), ZERO);
    if (quantity.gt(available))
      throw new InsufficientQuantityError(trade.date, quantity, available, trade.id);

    let toSell = quantity;
    let cost = ZERO;
    let costPln = ZERO;
    for (const lot of lots) {
      if (toSell.isZero()) break;
      if (lot.remaining.isZero()) continue;
      const take = lot.remaining.lte(toSell) ? lot.remaining : toSell;
      cost = cost.plus(take.times(lot.unitCost));
      costPln = costPln.plus(take.times(lot.unitCost).times(lot.fxRate));
      lot.remaining = lot.remaining.minus(take);
      toSell = toSell.minus(take);
    }
    const proceeds = quantity.times(price).minus(fee);
    const proceedsPln = proceeds.times(fxRate);
    sales.push({
      tradeId: trade.id,
      date: trade.date,
      quantity,
      proceeds,
      proceedsPln,
      cost,
      costPln,
      realized: proceeds.minus(cost),
      realizedPln: proceedsPln.minus(costPln),
    });
  }

  return { lots: lots.filter((l) => !l.remaining.isZero()), sales };
}

const cumulativeQuantity = memoByArray((trades: readonly TradeInput[]) => {
  let q = ZERO;
  return sortedByDate(trades).map((t) => {
    q = t.type === "BUY" ? q.plus(t.quantity) : q.minus(t.quantity);
    return { date: t.date, quantity: q };
  });
});

/** Ilość po wszystkich transakcjach z datą ≤ D (bez kosztów; szybka ścieżka do wyceny dzień po dniu). */
export function quantityOn(trades: readonly TradeInput[], date: DateKey): Dec {
  const cumulative = cumulativeQuantity(trades);
  const i = lastIndexOnOrBefore(cumulative, date);
  return i < 0 ? ZERO : cumulative[i].quantity;
}
