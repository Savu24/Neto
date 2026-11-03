import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { scopedDb } from "@/lib/db/scoped";
import { resetDb, testDb } from "../../../../tests/db";
import { seedCatalog } from "../catalog/seed";
import { parseAccountInput } from "../ledger/account-input";
import { parseTransactionInput } from "../ledger/input";
import { loadPortfolio } from "../ledger/load";
import { createAccount, recordTransaction, type Ledger } from "../ledger/service";
import type { Mapping } from "./mapping";
import {
  analyzeImport,
  commitImport,
  ImportError,
  previewImport,
  recentImports,
  REVERT_WINDOW_MS,
  revertImport,
} from "./service";

const base = testDb();
const today = "2026-11-03";
const enc = (s: string) => new TextEncoder().encode(s);

async function user(email: string): Promise<Ledger> {
  const u = await base.user.create({ data: { email } });
  return { db: scopedDb(base, u.id), userId: u.id, today };
}

const BANK_CSV = [
  "Wyciąg z rachunku nr 12 3456",
  "",
  "Data operacji;Opis operacji;Kwota",
  "02.10.2026;Wynagrodzenie;8 000,00",
  "05.10.2026;Czynsz;-2 150,00",
  '06.10.2026;"Kawa ""Pod Lipą""";-12,50',
  "06.10.2026;Bilet;abc",
  "",
].join("\n");

beforeEach(() => resetDb(base));
afterAll(() => base.$disconnect());

describe("import CSV (HU-2.4)", () => {
  async function checking(l: Ledger) {
    return createAccount(
      l,
      parseAccountInput(
        { name: "Konto osobiste", type: "CHECKING", openingAmount: "10000", openingDate: "2026-10-01" },
        today,
        "create",
      ),
    );
  }

  it("plik → mapowanie → podgląd → import; duplikaty przy ponownym imporcie; mapowanie zapamiętane", async () => {
    const l = await user("a@test.localhost");
    const acc = await checking(l);
    const file = { accountId: acc.id, fileName: "wyciag.csv", bytes: enc(BANK_CSV) };

    const analysis = await analyzeImport(l, file);
    expect(analysis.headers).toEqual(["Data operacji", "Opis operacji", "Kwota"]);
    expect(analysis.rowCount).toBe(4);
    expect(analysis.remembered).toBe(false);
    expect(analysis.mapping).toMatchObject({
      columns: { date: "Data operacji", description: "Opis operacji", amount: "Kwota" },
      dateFormat: "DMY",
      numberFormat: "comma",
    });

    const preview = await previewImport(l, file, analysis.mapping);
    expect(preview).toMatchObject({ total: 4, ok: 3, errors: 1, duplicates: 0 });
    expect(preview.rows[0]).toMatchObject({ status: "error", error: "badAmount", line: 7 });
    expect(await l.db.transaction.count()).toBe(1); // podgląd niczego nie zapisuje

    const result = await commitImport(l, file, analysis.mapping);
    expect(result).toMatchObject({ imported: 3, errors: 1 });
    const imported = await l.db.transaction.findMany({
      where: { importBatchId: result.batchId },
      orderBy: { date: "asc" },
    });
    expect(imported.map((t) => [t.type, t.amount.toString(), t.note])).toEqual([
      ["DEPOSIT", "8000", "Wynagrodzenie"],
      ["WITHDRAWAL", "-2150", "Czynsz"],
      ["WITHDRAWAL", "-12.5", 'Kawa "Pod Lipą"'],
    ]);
    expect((await loadPortfolio(l.db, today)).netWorth).toBe("15837.5");
    expect(await l.db.recalcJob.count()).toBe(1);

    // drugi raz: wszystko to duplikaty, mapowanie podpowiadane z pamięci
    const again = await analyzeImport(l, file);
    expect(again.remembered).toBe(true);
    const second = await commitImport(l, file, again.mapping);
    expect(second).toMatchObject({ imported: 0, duplicates: 3, errors: 1 });
    expect((await loadPortfolio(l.db, today)).netWorth).toBe("15837.5");
  });

  it("Windows-1250 i format 1,234.56", async () => {
    const l = await user("a@test.localhost");
    const acc = await checking(l);
    // „Wpłata” w Windows-1250: ł = 0xB3
    const bytes = Uint8Array.from([
      ...enc("Date,Description,Amount\n2026-10-02,Wp"),
      0xb3,
      ...enc('ata,"1,234.56"\n'),
    ]);
    const file = { accountId: acc.id, fileName: "export.csv", bytes };
    const a = await analyzeImport(l, file);
    expect(a.encoding).toBe("windows-1250");
    expect(a.delimiter).toBe(",");
    expect(a.mapping.numberFormat).toBe("dot");
    const r = await commitImport(l, file, a.mapping);
    expect(r.imported).toBe(1);
    const t = await l.db.transaction.findFirstOrThrow({ where: { importBatchId: r.batchId } });
    expect(t.note).toBe("Wpłata");
    expect(t.amount.toString()).toBe("1234.56");
  });

  it("broker: instrumenty z katalogu, sprzedaż ponad stan jako błąd wiersza, nieznany ticker", async () => {
    await seedCatalog(base);
    const l = await user("a@test.localhost");
    const acc = await createAccount(
      l,
      parseAccountInput({ name: "Maklerskie", type: "BROKERAGE" }, today, "create"),
    );
    const csv = [
      "Data;Typ;Ticker;Ilość;Cena;Prowizja",
      "2026-10-01;Kupno;PKO;10;50,00;5,00",
      "2026-10-02;Sprzedaż;PKO;4;60,00;2,00",
      "2026-10-03;Sprzedaż;PKO;7;60,00;0",
      "2026-10-03;Kupno;NIEMA;1;1;0",
    ].join("\n");
    const file = { accountId: acc.id, fileName: "broker.csv", bytes: enc(csv) };
    const a = await analyzeImport(l, file);
    const preview = await previewImport(l, file, a.mapping);
    expect(preview).toMatchObject({ ok: 2, errors: 2 });
    expect(preview.rows.filter((r) => r.status === "error").map((r) => [r.line, r.error, r.params])).toEqual([
      [4, "insufficientQuantity", { available: "6", requested: "7" }],
      [5, "unknownInstrument", { value: "NIEMA" }],
    ]);
    const r = await commitImport(l, file, a.mapping);
    expect(r.imported).toBe(2);
    const h = await l.db.holding.findFirstOrThrow({ include: { asset: true } });
    expect(h.asset.symbol).toBe("PKO");
    expect(h.quantity.toString()).toBe("6");
    expect(h.costBasis.toString()).toBe("303"); // 6 × (505 / 10)
  });

  it("cofnięcie w 24 h przywraca stan; po 24 h i drugi raz — błąd", async () => {
    const l = await user("a@test.localhost");
    const acc = await checking(l);
    const file = { accountId: acc.id, fileName: "wyciag.csv", bytes: enc(BANK_CSV) };
    const mapping = (await analyzeImport(l, file)).mapping;
    const r = await commitImport(l, file, mapping);
    expect((await recentImports(l))[0]).toMatchObject({ id: r.batchId, canRevert: true, imported: 3 });
    const late = new Date(Date.now() + REVERT_WINDOW_MS + 60_000);
    await expect(revertImport(l, r.batchId, late)).rejects.toMatchObject({ code: "revertExpired" });
    await revertImport(l, r.batchId);
    expect((await loadPortfolio(l.db, today)).netWorth).toBe("10000");
    expect((await l.db.importBatch.findUniqueOrThrow({ where: { id: r.batchId } })).status).toBe("REVERTED");
    await expect(revertImport(l, r.batchId)).rejects.toBeInstanceOf(ImportError);
    // po cofnięciu ten sam plik można zaimportować ponownie (to nie są już duplikaty)
    expect((await commitImport(l, file, mapping)).imported).toBe(3);
  });

  it("cofnięcie, które zostawiłoby sprzedaż bez kupna, jest zablokowane", async () => {
    const l = await user("a@test.localhost");
    await seedCatalog(base);
    const acc = await createAccount(
      l,
      parseAccountInput({ name: "Maklerskie", type: "BROKERAGE" }, today, "create"),
    );
    const file = {
      accountId: acc.id,
      fileName: "kupno.csv",
      bytes: enc("Data;Typ;Ticker;Ilość;Cena\n2026-10-01;Kupno;PKO;10;50\n"),
    };
    const r = await commitImport(l, file, (await analyzeImport(l, file)).mapping);
    const pko = (await l.db.holding.findFirstOrThrow()).assetId;
    await recordTransaction(
      l,
      parseTransactionInput(
        { accountId: acc.id, type: "SELL", date: "2026-10-05", assetId: pko, quantity: "5", price: "55" },
        today,
      ),
    );
    await expect(revertImport(l, r.batchId)).rejects.toMatchObject({ code: "revertBreaksSale" });
  });

  it("izolacja: cudze konto i cudzy import są niewidoczne", async () => {
    const a = await user("a@test.localhost");
    const b = await user("b@test.localhost");
    const acc = await checking(a);
    const file = { accountId: acc.id, fileName: "wyciag.csv", bytes: enc(BANK_CSV) };
    const mapping: Mapping = (await analyzeImport(a, file)).mapping;
    const r = await commitImport(a, file, mapping);
    await expect(analyzeImport(b, file)).rejects.toMatchObject({ code: "account" });
    await expect(previewImport(b, file, mapping)).rejects.toMatchObject({ code: "account" });
    await expect(commitImport(b, file, mapping)).rejects.toMatchObject({ code: "account" });
    await expect(revertImport(b, r.batchId)).rejects.toMatchObject({ code: "batch" });
    expect(await recentImports(b)).toEqual([]);
    expect(await base.transaction.count({ where: { importBatchId: r.batchId } })).toBe(3);
  });
});
