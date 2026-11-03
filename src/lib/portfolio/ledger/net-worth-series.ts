import "server-only";
import type { ScopedDb } from "@/lib/db/scoped";
import type { Dec } from "@/lib/money";
import {
  addDays,
  addMonths,
  endOfMonth,
  netWorthAt,
  type DateKey,
  type PricePoint,
} from "@/lib/portfolio/valuation";
import { accountInputOf, toLedgerAsset } from "./load";
import type { LedgerTransaction } from "./positions";
import { dateFromKey, keyFromDate, loadFxTable, toLedgerTx } from "./service";

/**
 * Historia wartości netto do pulpitu (HU-4.1, 4.2), liczona na bieżąco z transakcji, cen i kursów
 * w bazie (nie wymaga nocnych migawek). Punkty: koniec każdego miesiąca od pierwszej transakcji
 * (najwyżej 10 lat) i każdy z ostatnich 31 dni. Konta zarchiwizowane pomijamy, jak wycena bieżąca.
 */

export interface SeriesPoint {
  readonly date: DateKey;
  readonly assets: string;
  readonly liabilities: string;
  readonly netWorth: string;
}

export interface NetWorthSeries {
  readonly points: readonly SeriesPoint[];
  /** Alokacja na dziś (aktywa w PLN). */
  readonly byClass: Readonly<Record<string, string>>;
  readonly byCurrency: Readonly<Record<string, string>>;
  readonly byAccount: Readonly<Record<string, string>>;
}

const MAX_MONTHS = 120;

/** Daty punktów: końce miesięcy od `first` do dziś + ostatnie 31 dni, rosnąco, bez powtórzeń. */
export function seriesDates(first: DateKey, today: DateKey): DateKey[] {
  const dates = new Set<DateKey>();
  const start = first > addMonths(today, -MAX_MONTHS) ? first : addMonths(today, -MAX_MONTHS);
  // Dzień przed pierwszą transakcją: wykres zaczyna się od zera, nie od pierwszej kwoty.
  dates.add(addDays(start, -1));
  for (let d = endOfMonth(start); d < today; d = endOfMonth(addMonths(d, 1))) dates.add(d);
  for (let i = 30; i >= 0; i--) {
    const d = addDays(today, -i);
    if (d >= addDays(start, -1)) dates.add(d);
  }
  return [...dates].sort();
}

const str = (map: Readonly<Record<string, Dec>>) =>
  Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v.toFixed()]));

export async function loadNetWorthSeries(db: ScopedDb, today: DateKey): Promise<NetWorthSeries> {
  const accounts = await db.financialAccount.findMany({
    where: { archivedAt: null },
    include: { deposit: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const ids = accounts.map((a) => a.id);
  const txRows = ids.length
    ? await db.transaction.findMany({
        where: { accountId: { in: ids }, date: { lte: dateFromKey(today) } },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      })
    : [];
  if (txRows.length === 0 && !accounts.some((a) => a.deposit)) {
    return { points: [], byClass: {}, byCurrency: {}, byAccount: {} };
  }

  const assetIds = [...new Set(txRows.map((t) => t.assetId).filter((x): x is string => x !== null))];
  const [assetRows, priceRows] = assetIds.length
    ? await Promise.all([
        db.asset.findMany({ where: { id: { in: assetIds } }, include: { retailBondSeries: true } }),
        db.priceSnapshot.findMany({
          where: { assetId: { in: assetIds }, date: { lte: dateFromKey(today) } },
          orderBy: { date: "asc" },
          select: { assetId: true, date: true, close: true },
        }),
      ])
    : [[], []];
  const prices = new Map<string, PricePoint[]>();
  for (const p of priceRows) {
    const list = prices.get(p.assetId) ?? [];
    list.push({ date: keyFromDate(p.date), close: p.close.toString() });
    prices.set(p.assetId, list);
  }
  const fx = await loadFxTable(
    db,
    [
      ...accounts.map((a) => a.currency),
      ...txRows.map((t) => t.currency),
      ...assetRows.map((a) => a.currency),
    ],
    today,
  );

  const txByAccount = new Map<string, LedgerTransaction[]>();
  for (const t of txRows) {
    const list = txByAccount.get(t.accountId) ?? [];
    list.push(toLedgerTx(t));
    txByAccount.set(t.accountId, list);
  }
  const ledgerAssets = new Map(
    assetRows.map((a) => [a.id, toLedgerAsset(a as Parameters<typeof toLedgerAsset>[0])]),
  );
  const inputs = accounts.map((a) =>
    accountInputOf(a, txByAccount.get(a.id) ?? [], { assets: ledgerAssets, prices }),
  );

  const starts = [
    ...txRows.map((t) => keyFromDate(t.date)),
    ...accounts.flatMap((a) => (a.deposit ? [keyFromDate(a.deposit.startDate)] : [])),
  ];
  const first = starts.reduce((m, d) => (d < m ? d : m), today);
  const results = seriesDates(first, today).map((d) => netWorthAt(inputs, d, fx));
  const last = results[results.length - 1];
  return {
    points: results.map((r) => ({
      date: r.date,
      assets: r.assets.toFixed(),
      liabilities: r.liabilities.toFixed(),
      netWorth: r.netWorth.toFixed(),
    })),
    byClass: str(last.byClass),
    byCurrency: str(last.byCurrency),
    byAccount: str(last.byAccount),
  };
}
