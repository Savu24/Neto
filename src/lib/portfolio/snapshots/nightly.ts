import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { dateFromKey, keyFromDate } from "@/lib/portfolio/ledger/service";
import { addDays, maxDate, minDate, type DateKey } from "@/lib/portfolio/valuation";
import type { FxProvider, InstrumentRef, Pricing } from "@/lib/pricing";
import { missingRanges } from "./schedule";
import { refreshUserSnapshots } from "./service";

/**
 * Nocna wycena (SPEC 7.7), wołana przez `/api/cron/valuation`. Zadanie systemowe, więc tabele globalne
 * (`FxRate`, `PriceSnapshot`) i kolejkę `RecalcJob` czyta surowy klient; dane majątku każdego użytkownika
 * idą przez `scopedDb` w `refreshUserSnapshots`. Kroki są idempotentne (klucze unikalne), błąd jednej
 * waluty, instrumentu czy użytkownika jest liczony i logowany, a reszta idzie dalej. Po `deadline`
 * nie zaczynamy nowych użytkowników (`more: true`): kolejne wywołanie dokończy pozostałych.
 */

/** Najstarsze dane tabeli A w API NBP. */
export const NBP_FIRST_DATE = "2002-01-02";
/** Kurs na pierwszy dzień historii może pochodzić z kilku dni wcześniej (weekend, święta). */
const FX_LOOKBACK_DAYS = 14;
/** Ile razy ponawiamy zadanie przeliczenia, zanim oznaczymy je jako FAILED. */
export const RECALC_MAX_ATTEMPTS = 3;

export type Logger = (message: string, context: Record<string, unknown>) => void;

const defaultLogger: Logger = (message, context) => console.error(`[cron/valuation] ${message}`, context);

const errorText = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e)).slice(0, 500);

export interface FxSyncResult {
  readonly currencies: number;
  readonly inserted: number;
  /** Waluty bez kursów w tabeli A (NBP zwraca 404); wymagają kursu ręcznego. */
  readonly unsupported: readonly string[];
  readonly failed: readonly string[];
}

/** Najwcześniejszy dzień, od którego potrzebny jest kurs waluty: transakcje i lokaty w tej walucie. */
async function fxNeededFrom(base: PrismaClient, currency: string): Promise<DateKey | null> {
  const [tx, deposit] = await Promise.all([
    base.transaction.findFirst({
      where: { OR: [{ currency }, { asset: { currency } }, { account: { currency } }] },
      orderBy: { date: "asc" },
      select: { date: true },
    }),
    base.deposit.findFirst({
      where: { account: { currency } },
      orderBy: { startDate: "asc" },
      select: { startDate: true },
    }),
  ]);
  const dates = [tx?.date, deposit?.startDate].filter((d): d is Date => d !== undefined).map(keyFromDate);
  return dates.length ? dates.reduce(minDate) : null;
}

/** Waluty używane przez kogokolwiek: konta, transakcje i instrumenty z transakcjami. */
export async function usedCurrencies(base: PrismaClient): Promise<string[]> {
  const [accounts, txs, assets] = await Promise.all([
    base.financialAccount.findMany({ distinct: ["currency"], select: { currency: true } }),
    base.transaction.findMany({ distinct: ["currency"], select: { currency: true } }),
    base.asset.findMany({
      where: { transactions: { some: {} } },
      distinct: ["currency"],
      select: { currency: true },
    }),
  ]);
  return [...new Set([...accounts, ...txs, ...assets].map((r) => r.currency))]
    .filter((c) => c !== "PLN")
    .sort();
}

/**
 * Kursy NBP (tabela A) do `FxRate`: dla każdej używanej waluty brakujący koniec (od ostatniego zapisanego
 * kursu do dziś) i brakujący początek (od pierwszej transakcji w tej walucie). Zapis `createMany` z pominięciem
 * istniejących kluczy (data, waluta), więc kurs ręczny z tego samego dnia nie jest nadpisywany.
 */
export async function syncFxRates(
  base: PrismaClient,
  fx: FxProvider,
  today: DateKey,
  log: Logger = defaultLogger,
): Promise<FxSyncResult> {
  const currencies = await usedCurrencies(base);
  let inserted = 0;
  const unsupported: string[] = [];
  const failed: string[] = [];
  for (const currency of currencies) {
    try {
      const agg = await base.fxRate.aggregate({
        where: { currency },
        _min: { date: true },
        _max: { date: true },
      });
      const stored =
        agg._min.date && agg._max.date
          ? { from: keyFromDate(agg._min.date), to: keyFromDate(agg._max.date) }
          : null;
      const neededFrom = (await fxNeededFrom(base, currency)) ?? today;
      const from = maxDate(addDays(neededFrom, -FX_LOOKBACK_DAYS), NBP_FIRST_DATE);
      if (!stored) {
        // Najpierw ostatnie dni: waluty spoza tabeli A (404) nie ściągają co noc całej historii.
        const recent = await fx.getHistory(currency, addDays(today, -FX_LOOKBACK_DAYS), today);
        if (recent.length === 0) {
          unsupported.push(currency);
          continue;
        }
      }
      for (const range of missingRanges({ from, to: today }, stored)) {
        const quotes = await fx.getHistory(currency, range.from, range.to);
        if (quotes.length === 0) continue;
        const res = await base.fxRate.createMany({
          data: quotes.map((q) => ({
            date: dateFromKey(q.date),
            currency: q.currency,
            ratePln: q.ratePln.toFixed(),
            table: q.table,
            source: q.source,
          })),
          skipDuplicates: true,
        });
        inserted += res.count;
      }
    } catch (e) {
      failed.push(currency);
      log("kursy walut: błąd", { currency, error: errorText(e) });
    }
  }
  return { currencies: currencies.length, inserted, unsupported, failed };
}

export interface PriceSyncResult {
  readonly status: Pricing["marketStatus"];
  readonly assets: number;
  readonly inserted: number;
  readonly failed: number;
}

/**
 * Ceny zamknięcia od dostawcy rynkowego do `PriceSnapshot` dla instrumentów `priceSource: PROVIDER`, które ktoś
 * ma w transakcjach: od dnia po ostatniej zapisanej cenie (albo od pierwszej transakcji) do dziś.
 * Bez skonfigurowanego dostawcy (`features().marketPricing`, implementacja w `market.ts`) krok jest pomijany.
 */
export async function syncMarketPrices(
  base: PrismaClient,
  pricing: Pick<Pricing, "market" | "marketStatus">,
  today: DateKey,
  log: Logger = defaultLogger,
): Promise<PriceSyncResult> {
  const market = pricing.market;
  if (!market) return { status: pricing.marketStatus, assets: 0, inserted: 0, failed: 0 };
  const assets = await base.asset.findMany({
    where: { priceSource: "PROVIDER", active: true, transactions: { some: {} } },
    orderBy: { id: "asc" },
  });
  let inserted = 0;
  let failed = 0;
  for (const asset of assets) {
    try {
      const [last, firstTx] = await Promise.all([
        base.priceSnapshot.findFirst({
          where: { assetId: asset.id },
          orderBy: { date: "desc" },
          select: { date: true },
        }),
        base.transaction.findFirst({
          where: { assetId: asset.id },
          orderBy: { date: "asc" },
          select: { date: true },
        }),
      ]);
      const from = last ? addDays(keyFromDate(last.date), 1) : keyFromDate(firstTx!.date);
      if (from > today) continue;
      const ref: InstrumentRef = {
        assetId: asset.id,
        currency: asset.currency,
        symbol: asset.symbol ?? undefined,
        isin: asset.isin ?? undefined,
        exchange: asset.exchange ?? undefined,
        providerRef: asset.providerRef ?? undefined,
        priceSource: asset.priceSource,
      };
      const quotes = await market.getHistory(ref, from, today);
      if (quotes.length === 0) continue;
      const res = await base.priceSnapshot.createMany({
        data: quotes.map((q) => ({
          assetId: asset.id,
          date: dateFromKey(q.date),
          close: q.close.toFixed(),
          currency: q.currency,
          source: q.source,
        })),
        skipDuplicates: true,
      });
      inserted += res.count;
    } catch (e) {
      failed++;
      log("ceny rynkowe: błąd", { assetId: asset.id, provider: market.id, error: errorText(e) });
    }
  }
  return { status: pricing.marketStatus, assets: assets.length, inserted, failed };
}

export interface SnapshotsResult {
  readonly users: number;
  readonly written: number;
  readonly backfilled: number;
  readonly recalcJobs: number;
  readonly failed: number;
  /** Zabrakło czasu: część użytkowników czeka na kolejne wywołanie. */
  readonly more: boolean;
}

/**
 * Migawki dla użytkowników, którzy nie mają jeszcze migawki z dziś albo mają zadanie „przelicz od D”
 * (najpierw ci z zadaniami). Każdy użytkownik osobno; zadania są przejmowane (PENDING → RUNNING),
 * po sukcesie DONE, po błędzie wracają do kolejki aż do `RECALC_MAX_ATTEMPTS` prób, potem FAILED.
 */
export async function processSnapshots(
  base: PrismaClient,
  today: DateKey,
  opts: { deadline?: number; log?: Logger } = {},
): Promise<SnapshotsResult> {
  const log = opts.log ?? defaultLogger;
  // Zadania RUNNING zostają tylko po przerwanym przebiegu (cron działa raz na dobę) — wracają do kolejki.
  await base.recalcJob.updateMany({ where: { status: "RUNNING" }, data: { status: "PENDING" } });

  const todayDate = dateFromKey(today);
  const candidates = await base.user.findMany({
    where: {
      deletionRequestedAt: null,
      financialAccounts: { some: {} },
      OR: [
        { recalcJobs: { some: { status: "PENDING" } } },
        { portfolioSnapshots: { none: { date: todayDate } } },
      ],
    },
    select: { id: true, recalcJobs: { where: { status: "PENDING" }, select: { id: true, fromDate: true } } },
    orderBy: { id: "asc" },
  });
  candidates.sort((a, b) => Number(b.recalcJobs.length > 0) - Number(a.recalcJobs.length > 0));

  let users = 0;
  let written = 0;
  let backfilled = 0;
  let recalcJobs = 0;
  let failed = 0;
  for (const user of candidates) {
    if (opts.deadline !== undefined && Date.now() > opts.deadline) {
      return { users, written, backfilled, recalcJobs, failed, more: true };
    }
    const jobIds = user.recalcJobs.map((j) => j.id);
    if (jobIds.length) {
      await base.recalcJob.updateMany({
        where: { id: { in: jobIds }, status: "PENDING" },
        data: { status: "RUNNING", attempts: { increment: 1 } },
      });
    }
    const recalcFrom = user.recalcJobs.length
      ? user.recalcJobs.map((j) => keyFromDate(j.fromDate)).reduce(minDate)
      : null;
    try {
      const res = await refreshUserSnapshots(base, user.id, today, { recalcFrom });
      users++;
      written += res.written;
      if (res.backfilled) backfilled++;
      if (jobIds.length) {
        await base.recalcJob.updateMany({
          where: { id: { in: jobIds } },
          data: { status: "DONE", lastError: null },
        });
        recalcJobs += jobIds.length;
      }
    } catch (e) {
      failed++;
      const error = errorText(e);
      log("migawki: błąd użytkownika", { userId: user.id, recalcFrom, error });
      if (jobIds.length) {
        await base.recalcJob.updateMany({
          where: { id: { in: jobIds }, attempts: { gte: RECALC_MAX_ATTEMPTS } },
          data: { status: "FAILED", lastError: error },
        });
        await base.recalcJob.updateMany({
          where: { id: { in: jobIds }, status: "RUNNING" },
          data: { status: "PENDING", lastError: error },
        });
      }
    }
  }
  return { users, written, backfilled, recalcJobs, failed, more: false };
}

export interface NightlyResult {
  readonly date: DateKey;
  readonly fx: FxSyncResult;
  readonly prices: PriceSyncResult;
  readonly snapshots: SnapshotsResult;
}

/** Cała nocna wycena: kursy → ceny → migawki (migawki liczą się z tego, co zdążyło trafić do bazy). */
export async function runNightlyValuation(opts: {
  readonly base: PrismaClient;
  readonly pricing: Pick<Pricing, "fx" | "market" | "marketStatus">;
  readonly today: DateKey;
  readonly deadline?: number;
  readonly log?: Logger;
}): Promise<NightlyResult> {
  const { base, pricing, today, log } = opts;
  const fx = await syncFxRates(base, pricing.fx, today, log);
  const prices = await syncMarketPrices(base, pricing, today, log);
  const snapshots = await processSnapshots(base, today, { deadline: opts.deadline, log });
  return { date: today, fx, prices, snapshots };
}
