import { sum } from "@/lib/money";
import {
  addMonths,
  applyFifo,
  endOfMonth,
  fxRateOn,
  lastOnOrBefore,
  lotCostPln,
  quantityOn,
  type DateKey,
  type FxTable,
  type PricePoint,
  type TradeInput,
} from "@/lib/portfolio/valuation";

/**
 * Historia pozycji do wykresu „Wartość i koszt” (makieta pozycja.html): na koniec kolejnych miesięcy
 * wartość w PLN (ilość × cena ≤ D × kurs ≤ D) i koszt pozostałych partii FIFO po kursach z dni zakupu.
 * Bez notowania ≤ D przyjmujemy cenę ostatniej transakcji (jak silnik wyceny). Punkty przed pierwszym
 * kupnem pomijamy; brak kursu → wartość `null` (przerwa na wykresie).
 */
export interface HistoryPoint {
  readonly date: DateKey;
  readonly valuePln: string | null;
  readonly costPln: string | null;
}

export function monthlyHistory(opts: {
  readonly trades: readonly TradeInput[];
  readonly prices: readonly PricePoint[];
  readonly fx: FxTable;
  readonly currency: string;
  readonly today: DateKey;
  readonly months: number;
}): HistoryPoint[] {
  const { trades, prices, fx, currency, today, months } = opts;
  if (trades.length === 0) return [];
  const first = trades.reduce((m, t) => (t.date < m ? t.date : m), trades[0].date);
  const dates: DateKey[] = [];
  for (let i = months - 1; i >= 1; i--) {
    const d = endOfMonth(addMonths(today, -i));
    if (d >= first) dates.push(d);
  }
  dates.push(today);

  return dates.map((date) => {
    const quantity = quantityOn(trades, date);
    const quote = lastOnOrBefore(prices, date) ?? lastOnOrBefore(trades, date);
    const rate = fxRateOn(fx, currency, date)?.rate ?? null;
    const price = quote ? ("close" in quote ? quote.close : quote.price) : null;
    const valuePln = price !== null && rate ? quantity.times(price).times(rate).toFixed(2) : null;
    let costPln: string | null = null;
    try {
      costPln = sum(applyFifo(trades, { currency, fx, upTo: date }).lots.map(lotCostPln)).toFixed(2);
    } catch {
      costPln = null;
    }
    return { date, valuePln, costPln };
  });
}
