import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { scopedDb } from "@/lib/db/scoped";
import { D } from "@/lib/money";
import type { FxProvider, FxQuote, PriceProvider, PriceQuote } from "@/lib/pricing";
import { resetDb, testDb } from "../../../../tests/db";
import { parseAccountInput } from "../ledger/account-input";
import { parseTransactionInput } from "../ledger/input";
import { loadPortfolio } from "../ledger/load";
import {
  createAccount,
  createManualAsset,
  recordTransaction,
  setManualPrice,
  type Ledger,
} from "../ledger/service";
import { addDays, type DateKey } from "../valuation";
import { processSnapshots, runNightlyValuation, RECALC_MAX_ATTEMPTS, type Logger } from "./nightly";
import { snapshotDates } from "./schedule";
import { backfillSnapshots } from "./service";

const base = testDb();
const today = "2026-11-03";
const day = (key: DateKey) => new Date(`${key}T00:00:00Z`);
const silent: Logger = () => {};

beforeEach(() => resetDb(base));
afterAll(() => base.$disconnect());

async function user(email: string): Promise<Ledger> {
  const u = await base.user.create({ data: { email } });
  return { db: scopedDb(base, u.id), userId: u.id, today };
}

const account = (l: Ledger, fields: Record<string, string>) =>
  createAccount(l, parseAccountInput(fields, today, "create"));
const record = (l: Ledger, fields: Record<string, string>) =>
  recordTransaction(l, parseTransactionInput(fields, today));

async function usdRate(date: DateKey, rate: string) {
  await base.fxRate.create({
    data: { date: day(date), currency: "USD", ratePln: rate, table: "A", source: "test" },
  });
}

/**
 * Portfel testowy z wynikami policzonymi ręcznie:
 * - rachunek: saldo 10 000 zł od 15.06;
 * - konto maklerskie: 10 szt. akcji w USD kupione 10.07 po 100 USD; ceny ręczne 110 (31.08) i 120 (02.11);
 *   kursy USD: 4,00 (10.07), 3,80 (31.08), 3,70 (02.11);
 * - kredyt: saldo 5 000 zł od 01.09.
 */
async function portfolio(l: Ledger) {
  await usdRate("2026-07-10", "4.00");
  await usdRate("2026-08-31", "3.80");
  await usdRate("2026-11-02", "3.70");
  const checking = await account(l, {
    name: "Rachunek",
    type: "CHECKING",
    openingAmount: "10000",
    openingDate: "2026-06-15",
  });
  const broker = await account(l, { name: "Makler", type: "BROKERAGE" });
  const stock = await createManualAsset(l, {
    name: "Akcja USD",
    symbol: "TST",
    isin: null,
    assetClass: "EQUITY",
    currency: "USD",
  });
  await record(l, {
    accountId: broker.id,
    type: "BUY",
    date: "2026-07-10",
    assetId: stock.id,
    quantity: "10",
    price: "100",
  });
  await setManualPrice(l, base, stock.id, "2026-08-31", "110");
  await setManualPrice(l, base, stock.id, "2026-11-02", "120");
  await account(l, { name: "Kredyt", type: "MORTGAGE", openingAmount: "5000", openingDate: "2026-09-01" });
  return { checking, broker, stock };
}

async function snapshots(userId: string) {
  const rows = await base.portfolioSnapshot.findMany({ where: { userId }, orderBy: { date: "asc" } });
  return new Map(rows.map((r) => [r.date.toISOString().slice(0, 10), r]));
}

const nw = (rows: Awaited<ReturnType<typeof snapshots>>, date: DateKey) =>
  rows.get(date)?.netWorth.toString();

/** Kursy z pamięci (bez sieci), jak NBP: tylko dni z publikacją. */
function fakeFx(rates: Record<string, Record<DateKey, string>>): FxProvider & { calls: number } {
  const quotes = (currency: string, from: DateKey, to: DateKey): FxQuote[] =>
    Object.entries(rates[currency] ?? {})
      .filter(([d]) => d >= from && d <= to)
      .sort()
      .map(([date, rate]) => ({ currency, date, ratePln: D(rate), table: "A", source: "nbp" }));
  const provider = {
    id: "fake",
    calls: 0,
    async getRate() {
      return null;
    },
    async getHistory(currency: string, from: DateKey, to: DateKey) {
      provider.calls++;
      return quotes(currency, from, to);
    },
  };
  return provider;
}

describe("backfillSnapshots", () => {
  it("historia od pierwszej transakcji zgodna z obliczeniem ręcznym", async () => {
    const l = await user("a@test.localhost");
    await portfolio(l);
    const res = await backfillSnapshots(base, l.userId, null, today);
    expect(res.from).toBe("2026-06-15");
    expect(res.written).toBe(snapshotDates("2026-06-15", today).length);

    const rows = await snapshots(l.userId);
    expect(nw(rows, "2026-06-15")).toBe("10000");
    expect(nw(rows, "2026-06-30")).toBe("10000");
    // brak notowania ≤ 31.07: cena z transakcji 100 USD × 4,00
    expect(nw(rows, "2026-07-31")).toBe("14000");
    // 10 × 110 × 3,80 = 4 180
    expect(nw(rows, "2026-08-31")).toBe("14180");
    // kredyt od 01.09
    expect(nw(rows, "2026-09-30")).toBe("9180");
    // 10 × 120 × 3,70 = 4 440
    const last = rows.get(today)!;
    expect(last.netWorth.toString()).toBe("9440");
    expect(last.assets.toString()).toBe("14440");
    expect(last.liabilities.toString()).toBe("5000");
    expect(last.byCurrency).toEqual({ PLN: "10000.0000", USD: "4440.0000" });
    expect(last.byClass).toMatchObject({ EQUITY: "4440.0000" });
    // saldo kredytu z 01.09 starsze niż 35 dni
    expect(last.staleCount).toBe(1);

    // migawka z dziś = suma z ekranu Majątek
    const view = await loadPortfolio(l.db, today);
    expect(D(view.netWorth).eq(last.netWorth.toString())).toBe(true);
  });

  it("zakres od–do i użytkownik bez kont", async () => {
    const l = await user("a@test.localhost");
    expect(await backfillSnapshots(base, l.userId, null, today)).toMatchObject({ written: 0 });
    await portfolio(l);
    const res = await backfillSnapshots(base, l.userId, "2026-08-01", "2026-09-30");
    expect(res.written).toBe(snapshotDates("2026-08-01", "2026-09-30").length);
    const rows = await snapshots(l.userId);
    expect([...rows.keys()][0]).toBe("2026-08-01");
    expect([...rows.keys()].at(-1)).toBe("2026-09-30");
  });
});

describe("processSnapshots", () => {
  it("pierwszy przebieg buduje historię, drugi niczego nie dubluje", async () => {
    const l = await user("a@test.localhost");
    await portfolio(l);
    const first = await processSnapshots(base, today, { log: silent });
    expect(first).toMatchObject({ users: 1, backfilled: 1, failed: 0, more: false });
    // zadania „przelicz od D” z zapisu transakcji zostały obsłużone
    expect(first.recalcJobs).toBeGreaterThan(0);
    expect(await base.recalcJob.count({ where: { status: { not: "DONE" } } })).toBe(0);
    const count = await base.portfolioSnapshot.count();
    expect(count).toBe(snapshotDates("2026-06-15", today).length);

    // użytkownik ma już migawkę z dziś i nic w kolejce → pomijany
    expect(await processSnapshots(base, today, { log: silent })).toMatchObject({ users: 0, written: 0 });
    // następnego dnia: jedna nowa migawka
    const next = await processSnapshots(base, addDays(today, 1), { log: silent });
    expect(next).toMatchObject({ users: 1, written: 1, backfilled: 0 });
    expect(await base.portfolioSnapshot.count()).toBe(count + 1);
  });

  it("RecalcJob: transakcja z datą wsteczną przelicza istniejące migawki od tej daty", async () => {
    const l = await user("a@test.localhost");
    const { checking } = await portfolio(l);
    await processSnapshots(base, today, { log: silent });
    const before = await snapshots(l.userId);
    expect(nw(before, "2026-07-31")).toBe("14000");

    await record(l, { accountId: checking.id, type: "DEPOSIT", date: "2026-08-15", amount: "1000" });
    const job = await base.recalcJob.findFirstOrThrow({ where: { status: "PENDING" } });
    expect(job.fromDate.toISOString().slice(0, 10)).toBe("2026-08-15");

    const res = await processSnapshots(base, today, { log: silent });
    expect(res).toMatchObject({ users: 1, recalcJobs: 1, failed: 0 });
    const after = await snapshots(l.userId);
    expect(nw(after, "2026-07-31")).toBe("14000");
    expect(nw(after, "2026-08-15")).toBe("15000");
    expect(nw(after, "2026-08-31")).toBe("15180");
    expect(nw(after, "2026-10-15")).toBe("10180");
    expect(nw(after, today)).toBe("10440");
    expect(await base.recalcJob.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({
      status: "DONE",
      attempts: 1,
      lastError: null,
    });
  });

  it("błąd jednego użytkownika nie zatrzymuje innych; zadanie wraca do kolejki, potem FAILED", async () => {
    const good = await user("a@test.localhost");
    const bad = await user("b@test.localhost");
    await account(good, {
      name: "Rachunek",
      type: "CHECKING",
      openingAmount: "100",
      openingDate: "2026-10-01",
    });
    const acc = await account(bad, {
      name: "Rachunek",
      type: "CHECKING",
      openingAmount: "100",
      openingDate: "2026-10-01",
    });
    // udział własności spoza 0–1: silnik wyceny rzuca
    await base.financialAccount.update({ where: { id: acc.id }, data: { ownershipShare: "0" } });

    const logged: unknown[] = [];
    const res = await processSnapshots(base, today, { log: (m, c) => logged.push({ m, ...c }) });
    expect(res).toMatchObject({ users: 1, failed: 1 });
    expect(logged).toMatchObject([{ userId: bad.userId }]);
    expect(await base.portfolioSnapshot.count({ where: { userId: good.userId } })).toBeGreaterThan(0);
    const job = await base.recalcJob.findFirstOrThrow({ where: { userId: bad.userId } });
    expect(job).toMatchObject({ status: "PENDING", attempts: 1 });
    expect(job.lastError).toContain("RangeError");

    for (let i = 1; i < RECALC_MAX_ATTEMPTS; i++) await processSnapshots(base, today, { log: silent });
    expect(await base.recalcJob.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({
      status: "FAILED",
      attempts: RECALC_MAX_ATTEMPTS,
    });
  });

  it("po upływie czasu nie zaczyna kolejnych użytkowników", async () => {
    const l = await user("a@test.localhost");
    await account(l, { name: "Rachunek", type: "CHECKING", openingAmount: "100", openingDate: "2026-10-01" });
    const res = await processSnapshots(base, today, { deadline: Date.now() - 1, log: silent });
    expect(res).toMatchObject({ users: 0, more: true });
    expect(await base.recalcJob.count({ where: { status: "PENDING" } })).toBe(1);
  });
});

describe("runNightlyValuation", () => {
  it("kursy NBP od pierwszej transakcji, waluty spoza tabeli A pomijane, przebieg idempotentny", async () => {
    const l = await user("a@test.localhost");
    await account(l, {
      name: "Konto USD",
      type: "SAVINGS",
      currency: "USD",
      openingAmount: "100",
      openingDate: "2026-10-28",
    });
    await account(l, { name: "Konto ARS", type: "SAVINGS", currency: "ARS" });
    const fx = fakeFx({
      USD: { "2026-10-16": "3.90", "2026-10-27": "3.95", "2026-10-30": "4.00", "2026-11-03": "4.05" },
    });
    const pricing = { fx, market: null, marketStatus: "disabled" as const };

    const first = await runNightlyValuation({ base, pricing, today, log: silent });
    expect(first.fx).toEqual({ currencies: 2, inserted: 4, unsupported: ["ARS"], failed: [] });
    expect(first.prices).toEqual({ status: "disabled", assets: 0, inserted: 0, failed: 0 });
    expect(first.snapshots).toMatchObject({ users: 1, failed: 0 });
    const rows = await snapshots(l.userId);
    // 100 USD × 4,05 (ARS bez kursu: brak wyceny, nie zero)
    expect(nw(rows, today)).toBe("405");
    expect(nw(rows, "2026-10-28")).toBe("395");
    expect(rows.get(today)!.staleCount).toBe(1);

    const fxRows = await base.fxRate.count();
    const second = await runNightlyValuation({ base, pricing, today, log: silent });
    expect(second.fx.inserted).toBe(0);
    expect(await base.fxRate.count()).toBe(fxRows);
    expect(second.snapshots).toMatchObject({ users: 0, written: 0 });
  });

  it("ceny rynkowe tylko z dostawcą; bez dublowania przy drugim przebiegu", async () => {
    const l = await user("a@test.localhost");
    const broker = await account(l, { name: "Makler", type: "BROKERAGE" });
    const asset = await base.asset.create({
      data: { name: "Spółka", symbol: "SPL", assetClass: "EQUITY", currency: "PLN", priceSource: "PROVIDER" },
    });
    await record(l, {
      accountId: broker.id,
      type: "BUY",
      date: "2026-10-30",
      assetId: asset.id,
      quantity: "2",
      price: "50",
    });
    const closes: Record<DateKey, string> = { "2026-10-30": "50", "2026-11-02": "55", "2026-11-03": "60" };
    const requested: [DateKey, DateKey][] = [];
    const market: PriceProvider = {
      id: "fake-market",
      async getClose() {
        return null;
      },
      async getHistory(instrument, from, to) {
        requested.push([from, to]);
        return Object.entries(closes)
          .filter(([d]) => d >= from && d <= to)
          .map(([date, close]): PriceQuote => ({
            assetId: instrument.assetId,
            date,
            close: D(close),
            currency: instrument.currency,
            source: "fake-market",
          }));
      },
    };
    const fx = fakeFx({});

    const off = await runNightlyValuation({
      base,
      pricing: { fx, market: null, marketStatus: "not-implemented" },
      today,
      log: silent,
    });
    expect(off.prices).toMatchObject({ status: "not-implemented", inserted: 0 });
    expect(await base.priceSnapshot.count()).toBe(0);

    const pricing = { fx, market, marketStatus: "active" as const };
    const on = await runNightlyValuation({ base, pricing, today, log: silent });
    expect(on.prices).toEqual({ status: "active", assets: 1, inserted: 3, failed: 0 });
    expect(requested).toEqual([["2026-10-30", today]]);

    // migawka z dziś liczy się już z ceny dostawcy (przeliczenie tego samego dnia, bo jest zadanie w kolejce)
    await base.recalcJob.create({ data: { userId: l.userId, fromDate: day("2026-10-30") } });
    await runNightlyValuation({ base, pricing, today, log: silent });
    // ceny są już do dziś: dostawca nie jest pytany ponownie
    expect(requested).toHaveLength(1);
    expect(await base.priceSnapshot.count()).toBe(3);
    const rows = await snapshots(l.userId);
    expect(nw(rows, today)).toBe("120");
    expect(nw(rows, "2026-11-02")).toBe("110");
  });
});
