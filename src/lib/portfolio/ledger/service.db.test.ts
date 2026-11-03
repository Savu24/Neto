import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { scopedDb, ScopeError } from "@/lib/db/scoped";
import { decryptOptional } from "@/lib/crypto/fields";
import { resetDb, testDb } from "../../../../tests/db";
import { seedCatalog } from "../catalog/seed";
import { searchInstruments } from "../catalog/search";
import { parseAccountInput } from "./account-input";
import { parseTransactionInput } from "./input";
import { loadPortfolio } from "./load";
import {
  createAccount,
  createManualAsset,
  deleteTransaction,
  ensureBondSeries,
  LedgerError,
  recordTransaction,
  setArchived,
  setBondRates,
  setManualPrice,
  updateAccount,
  type Ledger,
} from "./service";

const base = testDb();
const today = "2026-11-03";

async function user(email: string): Promise<Ledger> {
  const u = await base.user.create({ data: { email } });
  return { db: scopedDb(base, u.id), userId: u.id, today };
}

const account = (l: Ledger, fields: Record<string, string>) =>
  createAccount(l, parseAccountInput(fields, today, "create"));

const record = (l: Ledger, fields: Record<string, string>) =>
  recordTransaction(l, parseTransactionInput(fields, today));

async function code(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    if (e instanceof LedgerError) return { code: e.code, ...e.params };
    if (e instanceof ScopeError) return { code: "scope" };
    throw e;
  }
  return { code: "ok" };
}

beforeEach(() => resetDb(base));
afterAll(() => base.$disconnect());

describe("konta (HU-2.1, 2.8)", () => {
  it("zakłada konto z saldem startowym i szyfrowaną notatką", async () => {
    const l = await user("a@test.localhost");
    const acc = await account(l, {
      name: "Konto osobiste",
      type: "CHECKING",
      openingAmount: "10 000,00",
      openingDate: "2026-10-01",
      notes: "nr klienta 123",
    });
    expect(acc.kind).toBe("ASSET");
    expect(acc.notesEnc).not.toContain("123");
    expect(decryptOptional(acc.notesEnc)).toBe("nr klienta 123");
    const txs = await l.db.transaction.findMany({ where: { accountId: acc.id } });
    expect(txs).toMatchObject([{ type: "BALANCE_SET", currency: "PLN" }]);
    expect(txs[0].amount.toString()).toBe("10000");
    // saldo z datą wsteczną → zadanie przeliczenia od tej daty
    const jobs = await l.db.recalcJob.findMany();
    expect(jobs.map((j) => j.fromDate.toISOString().slice(0, 10))).toEqual(["2026-10-01"]);
  });

  it("lokata, kredyt i aktywo ręczne zapisują szczegóły i wartość startową", async () => {
    const l = await user("a@test.localhost");
    const checking = await account(l, { name: "Rachunek", type: "CHECKING" });
    const dep = await account(l, {
      name: "Lokata 6 mies.",
      type: "DEPOSIT",
      principal: "10000",
      rate: "5,1",
      startDate: "2026-06-03",
      termMonths: "6",
      capitalization: "END",
      payoutAccountId: checking.id,
    });
    const loan = await account(l, {
      name: "Hipoteka",
      type: "MORTGAGE",
      openingAmount: "548320,25",
      monthlyPayment: "3412",
      interestRate: "7,12",
    });
    const flat = await account(l, {
      name: "Mieszkanie",
      type: "REAL_ESTATE",
      openingAmount: "620000",
      openingDate: "2026-06-12",
      ownershipShare: "50",
    });
    expect(loan.kind).toBe("LIABILITY");
    expect((await l.db.deposit.findUnique({ where: { accountId: dep.id } }))?.payoutAccountId).toBe(
      checking.id,
    );
    expect(
      (await l.db.liability.findUnique({ where: { accountId: loan.id } }))?.monthlyPayment?.toString(),
    ).toBe("3412");

    const view = await loadPortfolio(l.db, today);
    const by = (id: string) => view.accounts.find((a) => a.id === id)!;
    expect(by(flat.id).valuePln).toBe("310000");
    expect(by(loan.id).valuePln).toBe("548320.25");
    expect(Number(by(dep.id).valuePln)).toBeGreaterThan(10000);
    expect(view.liabilities).toBe("548320.25");
  });

  it("edycja i archiwizacja: konto znika z bieżącego widoku, zostaje w archiwum", async () => {
    const l = await user("a@test.localhost");
    const acc = await account(l, { name: "Stare konto", type: "SAVINGS", openingAmount: "100" });
    await updateAccount(
      l,
      acc.id,
      parseAccountInput({ name: "Stare konto (zamknięte)", type: "SAVINGS" }, today, "edit", "SAVINGS"),
    );
    await setArchived(l, acc.id, true);
    expect((await loadPortfolio(l.db, today)).accounts).toHaveLength(0);
    const archived = await loadPortfolio(l.db, today, { archived: true });
    expect(archived.accounts.map((a) => a.name)).toEqual(["Stare konto (zamknięte)"]);
    expect(await code(record(l, { accountId: acc.id, type: "DEPOSIT", date: today, amount: "1" }))).toEqual({
      code: "archived",
    });
    await setArchived(l, acc.id, false);
    expect((await loadPortfolio(l.db, today)).accounts).toHaveLength(1);
  });
});

describe("transakcje (HU-2.3)", () => {
  async function ike(l: Ledger) {
    const acc = await account(l, { name: "IKE", type: "BROKERAGE", taxWrapper: "IKE" });
    const asset = await createManualAsset(l, {
      name: "ETF testowy",
      symbol: "ETFT",
      isin: null,
      assetClass: "ETF",
      currency: "PLN",
    });
    return { acc, asset };
  }

  it("kupno i sprzedaż przeliczają Holding i partie FIFO, sprzedaż ma wynik zrealizowany", async () => {
    const l = await user("a@test.localhost");
    const { acc, asset } = await ike(l);
    await record(l, {
      accountId: acc.id,
      type: "BUY",
      date: "2026-10-10",
      assetId: asset.id,
      quantity: "10",
      price: "100",
      fee: "5",
    });
    const sellId = await record(l, {
      accountId: acc.id,
      type: "SELL",
      date: "2026-10-20",
      assetId: asset.id,
      quantity: "4",
      price: "110",
      fee: "3",
    });
    const holding = await l.db.holding.findFirstOrThrow({ include: { lots: true } });
    expect(holding.quantity.toString()).toBe("6");
    expect(holding.costBasis.toString()).toBe("603");
    expect(holding.lots).toHaveLength(1);
    expect(holding.lots[0].unitCost.toString()).toBe("100.5");
    const sale = await l.db.transaction.findUniqueOrThrow({ where: { id: sellId } });
    expect(sale.realizedPnlBase?.toString()).toBe("35");
    expect(sale.amount.toString()).toBe("437");
  });

  it("sprzedaż ponad stan: błąd z dostępną ilością, nic się nie zapisuje", async () => {
    const l = await user("a@test.localhost");
    const { acc, asset } = await ike(l);
    await record(l, {
      accountId: acc.id,
      type: "BUY",
      date: "2026-10-10",
      assetId: asset.id,
      quantity: "10",
      price: "100",
    });
    const before = await l.db.transaction.count();
    expect(
      await code(
        record(l, {
          accountId: acc.id,
          type: "SELL",
          date: "2026-10-20",
          assetId: asset.id,
          quantity: "11",
          price: "1",
        }),
      ),
    ).toMatchObject({ code: "insufficient", available: "10", requested: "11" });
    // sprzedaż z datą przed kupnem też jest ponad stan (na ten dzień)
    expect(
      await code(
        record(l, {
          accountId: acc.id,
          type: "SELL",
          date: "2026-10-01",
          assetId: asset.id,
          quantity: "1",
          price: "1",
        }),
      ),
    ).toMatchObject({ code: "insufficient", available: "0" });
    expect(await l.db.transaction.count()).toBe(before);
    expect((await l.db.holding.findFirstOrThrow()).quantity.toString()).toBe("10");
  });

  it("usunięcie kupna, którego potrzebuje sprzedaż, jest zablokowane; usunięcie sprzedaży przelicza pozycję", async () => {
    const l = await user("a@test.localhost");
    const { acc, asset } = await ike(l);
    const buyId = await record(l, {
      accountId: acc.id,
      type: "BUY",
      date: "2026-10-10",
      assetId: asset.id,
      quantity: "10",
      price: "100",
    });
    const sellId = await record(l, {
      accountId: acc.id,
      type: "SELL",
      date: "2026-10-20",
      assetId: asset.id,
      quantity: "4",
      price: "110",
    });
    expect(await code(deleteTransaction(l, buyId))).toMatchObject({ code: "deleteBreaksSale" });
    await deleteTransaction(l, sellId);
    expect((await l.db.holding.findFirstOrThrow()).quantity.toString()).toBe("10");
    await deleteTransaction(l, buyId);
    expect(await l.db.holding.count()).toBe(0);
  });

  it("instrument w obcej walucie: bez kursu NBP błąd, z kursem ręcznym zapis", async () => {
    const l = await user("a@test.localhost");
    const acc = await account(l, { name: "Maklerskie", type: "BROKERAGE" });
    await seedCatalog(base);
    const [vwce] = await searchInstruments(l.db, "VWCE");
    expect(vwce.currency).toBe("EUR");
    expect(
      await code(
        record(l, {
          accountId: acc.id,
          type: "BUY",
          date: "2026-10-10",
          assetId: vwce.id,
          quantity: "1",
          price: "130",
        }),
      ),
    ).toMatchObject({ code: "missingFx", currency: "EUR", date: "2026-10-10" });
    await record(l, {
      accountId: acc.id,
      type: "BUY",
      date: "2026-10-10",
      assetId: vwce.id,
      quantity: "1",
      price: "130",
      fxRate: "4,25",
    });
    const h = await l.db.holding.findFirstOrThrow();
    expect(h.costBasisBase.toString()).toBe("552.5");
    // kurs NBP w bazie wystarcza bez kursu ręcznego
    await base.fxRate.create({
      data: {
        date: new Date("2026-10-09T00:00:00Z"),
        currency: "EUR",
        ratePln: "4.3",
        table: "A",
        source: "test",
      },
    });
    await record(l, {
      accountId: acc.id,
      type: "BUY",
      date: "2026-10-12",
      assetId: vwce.id,
      quantity: "1",
      price: "130",
    });
    expect((await l.db.holding.findFirstOrThrow()).costBasisBase.toString()).toBe("1111.5");
  });

  it("przelew między kontami: dwie strony z tym samym transferGroupId, usuwane razem", async () => {
    const l = await user("a@test.localhost");
    const a = await account(l, { name: "Rachunek", type: "CHECKING", openingAmount: "1000" });
    const b = await account(l, { name: "Oszczędności", type: "SAVINGS" });
    const id = await record(l, {
      accountId: a.id,
      type: "TRANSFER_OUT",
      date: today,
      amount: "250",
      toAccountId: b.id,
    });
    const pair = await l.db.transaction.findMany({
      where: { transferGroupId: { not: null } },
      orderBy: { amount: "asc" },
    });
    expect(pair.map((t) => [t.accountId, t.type, t.amount.toString()])).toEqual([
      [a.id, "TRANSFER_OUT", "-250"],
      [b.id, "TRANSFER_IN", "250"],
    ]);
    expect(pair[0].transferGroupId).toBe(pair[1].transferGroupId);
    const view = await loadPortfolio(l.db, today);
    expect(view.accounts.map((x) => x.valuePln)).toEqual(["750", "250"]);
    await deleteTransaction(l, id);
    expect(await l.db.transaction.count({ where: { transferGroupId: { not: null } } })).toBe(0);
  });

  it("niedozwolony rodzaj transakcji na koncie i data z przyszłości", async () => {
    const l = await user("a@test.localhost");
    const acc = await account(l, { name: "Rachunek", type: "CHECKING" });
    const asset = await createManualAsset(l, {
      name: "X",
      symbol: "X",
      isin: null,
      assetClass: "EQUITY",
      currency: "PLN",
    });
    expect(
      await code(
        record(l, {
          accountId: acc.id,
          type: "BUY",
          date: today,
          assetId: asset.id,
          quantity: "1",
          price: "1",
        }),
      ),
    ).toEqual({ code: "typeNotAllowed" });
    expect(() =>
      parseTransactionInput({ accountId: acc.id, type: "DEPOSIT", date: "2026-11-04", amount: "1" }, today),
    ).toThrow();
  });

  it("aktualizacja wyceny aktywa ręcznego to wpis historii (HU-2.5)", async () => {
    const l = await user("a@test.localhost");
    const car = await account(l, {
      name: "Samochód",
      type: "VEHICLE",
      openingAmount: "60000",
      openingDate: "2026-01-01",
    });
    await record(l, { accountId: car.id, type: "VALUATION", date: "2026-10-01", amount: "52 000" });
    expect(await l.db.transaction.count({ where: { accountId: car.id, type: "VALUATION" } })).toBe(2);
    expect((await loadPortfolio(l.db, today)).accounts[0].valuePln).toBe("52000");
  });

  it("ręczna cena instrumentu własnego i oznaczenie braku wyceny", async () => {
    const l = await user("a@test.localhost");
    const { acc, asset } = await ike(l);
    await record(l, {
      accountId: acc.id,
      type: "BUY",
      date: "2026-10-10",
      assetId: asset.id,
      quantity: "10",
      price: "100",
      fee: "5",
    });
    let pos = (await loadPortfolio(l.db, today)).accounts[0].positions.find((p) => p.kind === "market")!;
    expect(pos.missingPrice).toBe(true);
    expect(pos.priceFromTrade).toBe(true);
    await setManualPrice(l, base, asset.id, today, "120");
    pos = (await loadPortfolio(l.db, today)).accounts[0].positions.find((p) => p.kind === "market")!;
    expect(pos.missingPrice).toBe(false);
    expect(pos.valuePln).toBe("1200");
    expect(pos.resultPln).toBe("195");
  });

  it("obligacje skarbowe: seria jako instrument własny, oprocentowanie okresów", async () => {
    const l = await user("a@test.localhost");
    const acc = await account(l, { name: "Obligacje", type: "RETAIL_BONDS" });
    const edo = await ensureBondSeries(l, "EDO1035", "0.0675");
    expect(await ensureBondSeries(l, "edo1035", null)).toMatchObject({ id: edo.id });
    const series = await l.db.retailBondSeries.findUniqueOrThrow({ where: { assetId: edo.id } });
    expect(series.bondType).toBe("EDO");
    expect(series.issueMonth.toISOString().slice(0, 10)).toBe("2025-10-01");
    await record(l, {
      accountId: acc.id,
      type: "BUY",
      date: "2025-10-15",
      assetId: edo.id,
      quantity: "10",
      price: "100",
    });
    let view = await loadPortfolio(l.db, today);
    let bond = view.accounts[0].positions.find((p) => p.kind === "retailBond")!;
    expect(bond.quantity).toBe("10");
    expect(bond.bondRateMissing).toBe(true);
    await setBondRates(l, edo.id, ["0.0675", "0.06"]);
    view = await loadPortfolio(l.db, today);
    bond = view.accounts[0].positions.find((p) => p.kind === "retailBond")!;
    expect(bond.bondRateMissing).toBe(false);
    expect(Number(bond.value)).toBeGreaterThan(1067.5);
  });
});

describe("izolacja użytkowników (SPEC 8: cudze dane = nie znaleziono)", () => {
  it("drugi użytkownik nie widzi, nie zmienia i nie dopisuje do cudzych kont", async () => {
    const a = await user("a@test.localhost");
    const b = await user("b@test.localhost");
    const accA = await account(a, { name: "Konto A", type: "CHECKING", openingAmount: "100" });
    const accB = await account(b, { name: "Konto B", type: "CHECKING" });
    const assetA = await createManualAsset(a, {
      name: "Mój",
      symbol: "MOJ",
      isin: null,
      assetClass: "EQUITY",
      currency: "PLN",
    });
    const txA = await record(a, { accountId: accA.id, type: "DEPOSIT", date: today, amount: "5" });

    expect((await loadPortfolio(b.db, today)).accounts.map((x) => x.id)).toEqual([accB.id]);
    expect((await loadPortfolio(b.db, today, { accountId: accA.id })).accounts).toEqual([]);
    expect(await code(record(b, { accountId: accA.id, type: "DEPOSIT", date: today, amount: "1" }))).toEqual({
      code: "notFound",
    });
    expect(await code(deleteTransaction(b, txA))).toEqual({ code: "notFound" });
    expect(await code(setArchived(b, accA.id, true))).toEqual({ code: "notFound" });
    expect(
      await code(
        updateAccount(
          b,
          accA.id,
          parseAccountInput({ name: "x", type: "CHECKING" }, today, "edit", "CHECKING"),
        ),
      ),
    ).toEqual({ code: "notFound" });
    // przelew na cudze konto
    expect(
      await code(
        record(b, {
          accountId: accB.id,
          type: "TRANSFER_OUT",
          date: today,
          amount: "1",
          toAccountId: accA.id,
        }),
      ),
    ).toEqual({ code: "transferTarget" });
    // instrument własny innego użytkownika: niewidoczny w wyszukiwarce i bez możliwości kupna ani ceny
    expect(await searchInstruments(b.db, "MOJ")).toEqual([]);
    const brokerB = await account(b, { name: "Maklerskie B", type: "BROKERAGE" });
    expect(
      await code(
        record(b, {
          accountId: brokerB.id,
          type: "BUY",
          date: today,
          assetId: assetA.id,
          quantity: "1",
          price: "1",
        }),
      ),
    ).toEqual({ code: "notFound" });
    expect(await code(setManualPrice(b, base, assetA.id, today, "1"))).toEqual({ code: "notFound" });
    // lokata z kontem wypłaty innego użytkownika
    expect(
      await code(
        account(b, {
          name: "Lokata",
          type: "DEPOSIT",
          principal: "1",
          rate: "1",
          startDate: today,
          termMonths: "3",
          capitalization: "END",
          payoutAccountId: accA.id,
        }),
      ),
    ).toEqual({ code: "transferTarget" });
    // dane A nietknięte
    expect(await base.transaction.count({ where: { accountId: accA.id } })).toBe(2);
    expect((await base.financialAccount.findUniqueOrThrow({ where: { id: accA.id } })).archivedAt).toBeNull();
  });
});

describe("katalog (HU-2.2)", () => {
  it("seed jest idempotentny, wyszukiwanie po nazwie, tickerze i ISIN", async () => {
    const n = await seedCatalog(base);
    await seedCatalog(base);
    expect(await base.asset.count({ where: { userId: null } })).toBe(n);
    const l = await user("a@test.localhost");
    expect((await searchInstruments(l.db, "pko"))[0]).toMatchObject({ symbol: "PKO", exchange: "XWAR" });
    expect((await searchInstruments(l.db, "IE00BK5BQT80"))[0]).toMatchObject({ symbol: "VWCE" });
    expect((await searchInstruments(l.db, "all-world")).map((h) => h.symbol)).toContain("VWRL");
    expect(await searchInstruments(l.db, "")).toEqual([]);
  });
});
