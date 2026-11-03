import "server-only";
import type { ScopedDb } from "@/lib/db/scoped";
import { toAccountInput, type LedgerTransaction } from "@/lib/portfolio/ledger/positions";
import { toLedgerAsset } from "@/lib/portfolio/ledger/load";
import { dateFromKey, keyFromDate, loadFxTable, toLedgerTx } from "@/lib/portfolio/ledger/service";
import type { AccountInput, DateKey, FxTable, PricePoint } from "@/lib/portfolio/valuation";

/**
 * Pełna historia użytkownika do wyceny wielu dni naraz (migawki): konta, wszystkie transakcje do `upTo`,
 * wszystkie ceny instrumentów i kursy walut do `upTo`. Odczyt wyłącznie przez `scopedDb`.
 * Konta zarchiwizowane pomijamy, tak jak ekran Majątek (migawka z dziś = suma z ekranu).
 */
export interface ValuationInputs {
  readonly accounts: readonly AccountInput[];
  readonly fx: FxTable;
  /** Najwcześniejsza data danych (transakcja albo założenie lokaty); `null`, gdy kont nie ma lub są puste. */
  readonly firstDate: DateKey | null;
  readonly accountCount: number;
}

export async function loadValuationInputs(db: ScopedDb, upTo: DateKey): Promise<ValuationInputs> {
  const accounts = await db.financialAccount.findMany({
    where: { archivedAt: null },
    include: { deposit: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  if (accounts.length === 0) return { accounts: [], fx: {}, firstDate: null, accountCount: 0 };

  const txRows = await db.transaction.findMany({
    where: { accountId: { in: accounts.map((a) => a.id) }, date: { lte: dateFromKey(upTo) } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
  const assetIds = [...new Set(txRows.map((t) => t.assetId).filter((x): x is string => x !== null))];
  const [assetRows, priceRows] = assetIds.length
    ? await Promise.all([
        db.asset.findMany({ where: { id: { in: assetIds } }, include: { retailBondSeries: true } }),
        db.priceSnapshot.findMany({
          where: { assetId: { in: assetIds }, date: { lte: dateFromKey(upTo) } },
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
    upTo,
  );

  const txByAccount = new Map<string, LedgerTransaction[]>();
  for (const t of txRows) {
    const list = txByAccount.get(t.accountId) ?? [];
    list.push(toLedgerTx(t));
    txByAccount.set(t.accountId, list);
  }
  const ledgerAssets = new Map(assetRows.map((a) => [a.id, toLedgerAsset(a)]));

  let firstDate: DateKey | null = txRows.length ? keyFromDate(txRows[0].date) : null;
  for (const a of accounts) {
    const start = a.deposit ? keyFromDate(a.deposit.startDate) : null;
    if (start && start <= upTo && (!firstDate || start < firstDate)) firstDate = start;
  }

  return {
    accounts: accounts.map((a) =>
      toAccountInput(
        {
          id: a.id,
          type: a.type,
          currency: a.currency,
          ownershipShare: a.ownershipShare.toString(),
          includeInNetWorth: a.includeInNetWorth,
          deposit: a.deposit
            ? {
                principal: a.deposit.principal.toString(),
                rate: a.deposit.rate.toString(),
                startDate: keyFromDate(a.deposit.startDate),
                termMonths: a.deposit.termMonths,
                capitalization: a.deposit.capitalization,
                autoRenew: a.deposit.autoRenew,
              }
            : null,
          transactions: txByAccount.get(a.id) ?? [],
        },
        { assets: ledgerAssets, prices },
      ),
    ),
    fx,
    firstDate,
    accountCount: accounts.length,
  };
}
