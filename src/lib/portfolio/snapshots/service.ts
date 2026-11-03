import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { scopedDb, scopedTransaction, type ScopedDb } from "@/lib/db/scoped";
import { dateFromKey, keyFromDate } from "@/lib/portfolio/ledger/service";
import { addDays, netWorthAt, type DateKey } from "@/lib/portfolio/valuation";
import { loadValuationInputs, type ValuationInputs } from "./inputs";
import { mergeDates, recalcDates, snapshotDates, snapshotRow, type SnapshotRow } from "./schedule";

/**
 * Migawki wartości netto jednego użytkownika (SPEC 7.7): wycena silnikiem `valuation` na wybrane dni
 * i zapis do `PortfolioSnapshot`. Dostęp do danych użytkownika tylko przez `scopedDb`.
 */

export function computeSnapshots(inputs: ValuationInputs, dates: readonly DateKey[]): SnapshotRow[] {
  return dates.map((d) => snapshotRow(netWorthAt(inputs.accounts, d, inputs.fx)));
}

/**
 * Zapis migawek idempotentnie: w jednej transakcji usuwamy wiersze (userId, data) dla tych dni
 * i wstawiamy nowe, więc drugi przebieg nadpisuje te same klucze i niczego nie dubluje.
 */
export async function writeSnapshots(db: ScopedDb, userId: string, rows: readonly SnapshotRow[]) {
  if (rows.length === 0) return 0;
  const now = new Date();
  await scopedTransaction(
    db,
    async (tx) => {
      await tx.portfolioSnapshot.deleteMany({
        where: { date: { in: rows.map((r) => dateFromKey(r.date)) } },
      });
      await tx.portfolioSnapshot.createMany({
        data: rows.map((r) => ({ ...r, userId, date: dateFromKey(r.date), computedAt: now })),
      });
    },
    { timeout: 30_000 },
  );
  return rows.length;
}

export interface BackfillResult {
  readonly written: number;
  readonly from: DateKey | null;
  readonly to: DateKey;
}

/**
 * Historia wstecz: migawki od `from` (albo od pierwszej transakcji, gdy `null`) do `to` — na koniec
 * każdego miesiąca, w dniu początkowym i codziennie przez ostatnie 31 dni (`snapshotDates`).
 */
export async function backfillSnapshots(
  base: PrismaClient,
  userId: string,
  from: DateKey | null,
  to: DateKey,
): Promise<BackfillResult> {
  const db = scopedDb(base, userId);
  const inputs = await loadValuationInputs(db, to);
  const start = from ?? inputs.firstDate;
  if (inputs.accountCount === 0 || !start) return { written: 0, from: start, to };
  const written = await writeSnapshots(db, userId, computeSnapshots(inputs, snapshotDates(start, to)));
  return { written, from: start, to };
}

export interface RefreshResult {
  readonly written: number;
  /** Pierwsza migawka u użytkownika: historia zbudowana od pierwszej transakcji. */
  readonly backfilled: boolean;
}

/**
 * Nocne odświeżenie jednego użytkownika. Dni do zapisania:
 * - brak migawek → cała historia (`backfillSnapshots` od pierwszej transakcji);
 * - inaczej dni od ostatniej migawki do dziś (luka po nieudanym przebiegu) i dziś;
 * - zadanie „przelicz od D” → dodatkowo wszystkie istniejące migawki od D i harmonogram od D.
 */
export async function refreshUserSnapshots(
  base: PrismaClient,
  userId: string,
  today: DateKey,
  opts: { recalcFrom?: DateKey | null } = {},
): Promise<RefreshResult> {
  const db = scopedDb(base, userId);
  const inputs = await loadValuationInputs(db, today);
  if (inputs.accountCount === 0) return { written: 0, backfilled: false };

  const last = await db.portfolioSnapshot.findFirst({ orderBy: { date: "desc" }, select: { date: true } });
  const first = inputs.firstDate ?? today;
  const lists: DateKey[][] = [[today]];
  if (!last) lists.push(snapshotDates(first, today));
  else lists.push(snapshotDates(addDays(keyFromDate(last.date), 1), today));

  if (opts.recalcFrom && opts.recalcFrom <= today) {
    const existing = await db.portfolioSnapshot.findMany({
      where: { date: { gte: dateFromKey(opts.recalcFrom) } },
      select: { date: true },
    });
    lists.push(
      recalcDates(
        existing.map((s) => keyFromDate(s.date)),
        opts.recalcFrom,
        today,
        first,
      ),
    );
  }

  const written = await writeSnapshots(db, userId, computeSnapshots(inputs, mergeDates(...lists)));
  return { written, backfilled: !last };
}
