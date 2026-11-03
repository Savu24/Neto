import type { NetWorthResult } from "@/lib/portfolio/valuation";
import {
  addDays,
  addMonths,
  endOfMonth,
  maxDate,
  minDate,
  type DateKey,
} from "@/lib/portfolio/valuation/dates";

/**
 * Które dni dostają migawkę `PortfolioSnapshot` (SPEC 7.7). Historia budowana wstecz ma punkt w dniu
 * początkowym, na koniec każdego miesiąca i codziennie przez ostatnie `DAILY_DAYS` dni; dalej cron
 * dopisuje co noc dzień bieżący, więc gęstość rośnie sama.
 */
export const DAILY_DAYS = 31;

/** Dni migawek w [from, to]: `from`, końce miesięcy i ostatnie `dailyDays` dni do `to` włącznie. Rosnąco. */
export function snapshotDates(from: DateKey, to: DateKey, dailyDays = DAILY_DAYS): DateKey[] {
  if (from > to) return [];
  const out = new Set<DateKey>([from]);
  for (let m = endOfMonth(from); m <= to; m = endOfMonth(addMonths(m, 1))) out.add(m);
  for (let d = maxDate(from, addDays(to, -(dailyDays - 1))); d <= to; d = addDays(d, 1)) out.add(d);
  return [...out].sort();
}

/**
 * Dni do przeliczenia po zmianie z datą wsteczną `from` (zadanie `RecalcJob`): wszystkie istniejące
 * migawki od `from` (ich wartości są już nieaktualne) i punkty harmonogramu do `to`, ale harmonogram
 * nie wcześniej niż pierwsze dane użytkownika (`firstDate`), żeby nie dopisywać zer przed historią.
 */
export function recalcDates(
  existing: Iterable<DateKey>,
  from: DateKey,
  to: DateKey,
  firstDate: DateKey | null = null,
): DateKey[] {
  const out = new Set(snapshotDates(firstDate ? maxDate(from, firstDate) : from, to));
  for (const d of existing) if (d >= from && d <= to) out.add(d);
  return [...out].sort();
}

export function mergeDates(...lists: Iterable<DateKey>[]): DateKey[] {
  const out = new Set<DateKey>();
  for (const list of lists) for (const d of list) out.add(d);
  return [...out].sort();
}

export interface DateRange {
  readonly from: DateKey;
  readonly to: DateKey;
}

/**
 * Przedziały do dociągnięcia, gdy w bazie jest już ciągły zakres `stored` (np. kursy waluty od–do),
 * a potrzebny jest `needed`: brakujący początek i brakujący koniec. Dziur w środku nie szukamy.
 */
export function missingRanges(needed: DateRange, stored: DateRange | null): DateRange[] {
  if (needed.from > needed.to) return [];
  if (!stored) return [needed];
  const out: DateRange[] = [];
  if (needed.from < stored.from)
    out.push({ from: needed.from, to: minDate(addDays(stored.from, -1), needed.to) });
  if (stored.to < needed.to) out.push({ from: maxDate(addDays(stored.to, 1), needed.from), to: needed.to });
  return out;
}

/** Wiersz migawki z wyniku silnika: kwoty jako napisy z 4 miejscami (kolumny `Decimal(20,4)`). */
export interface SnapshotRow {
  readonly date: DateKey;
  readonly assets: string;
  readonly liabilities: string;
  readonly netWorth: string;
  readonly byClass: Record<string, string>;
  readonly byCurrency: Record<string, string>;
  readonly byAccount: Record<string, string>;
  readonly staleCount: number;
}

const fixed = (map: NetWorthResult["byClass"]) =>
  Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v.toFixed(4)]));

export function snapshotRow(result: NetWorthResult): SnapshotRow {
  return {
    date: result.date,
    assets: result.assets.toFixed(4),
    liabilities: result.liabilities.toFixed(4),
    netWorth: result.netWorth.toFixed(4),
    byClass: fixed(result.byClass),
    byCurrency: fixed(result.byCurrency),
    byAccount: fixed(result.byAccount),
    staleCount: result.staleCount,
  };
}
