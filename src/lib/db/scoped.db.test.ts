import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { resetDb, testDb } from "../../../tests/db";
import { ScopeError, policies, scopedDb, scopedTransaction } from "./scoped";

const base = testDb();
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

async function twoUsers() {
  const a = await base.user.create({ data: { email: "a@test.localhost", name: "Anna Żółć" } });
  const b = await base.user.create({ data: { email: "b@test.localhost" } });
  const accA = await base.financialAccount.create({
    data: { userId: a.id, name: "Konto oszczędnościowe", kind: "ASSET", type: "SAVINGS", currency: "PLN" },
  });
  const txA = await base.transaction.create({
    data: { accountId: accA.id, type: "DEPOSIT", date: day("2026-11-02"), amount: "100.00", currency: "PLN" },
  });
  return { a, b, accA, txA };
}

beforeEach(() => resetDb(base));
afterAll(() => base.$disconnect());

describe("scopedDb: reguły dostępu", () => {
  it("każdy model ze schematu ma regułę", () => {
    expect(Object.keys(policies).sort()).toEqual(Object.values(Prisma.ModelName).sort());
  });

  it("polskie znaki przechodzą przez bazę bez zmian (kodowanie UTF-8)", async () => {
    const { a, accA } = await twoUsers();
    expect((await base.user.findUniqueOrThrow({ where: { id: a.id } })).name).toBe("Anna Żółć");
    expect(accA.name).toBe("Konto oszczędnościowe");
  });

  it("właściciel widzi swoje konto i transakcje", async () => {
    const { a, accA } = await twoUsers();
    const sa = scopedDb(base, a.id);
    expect(await sa.financialAccount.findMany()).toHaveLength(1);
    expect(await sa.transaction.count()).toBe(1);
    expect(await sa.financialAccount.findUnique({ where: { id: accA.id } })).not.toBeNull();
  });

  it("inny użytkownik nie widzi cudzych danych w żadnej formie odczytu", async () => {
    const { b, accA, txA } = await twoUsers();
    const sb = scopedDb(base, b.id);
    expect(await sb.financialAccount.findMany()).toEqual([]);
    expect(await sb.financialAccount.findUnique({ where: { id: accA.id } })).toBeNull();
    expect(await sb.financialAccount.findFirst({ where: { name: accA.name } })).toBeNull();
    expect(await sb.transaction.findUnique({ where: { id: txA.id } })).toBeNull();
    expect(await sb.transaction.count()).toBe(0);
    const agg = await sb.transaction.aggregate({ _sum: { amount: true } });
    expect(agg._sum.amount).toBeNull();
    // include na własnym koncie nie może dociągnąć cudzych danych, bo zaczynamy od rekordów właściciela
    expect(await sb.financialAccount.findMany({ include: { transactions: true } })).toEqual([]);
  });

  it("inny użytkownik nie zmieni ani nie usunie cudzych danych", async () => {
    const { b, accA, txA } = await twoUsers();
    const sb = scopedDb(base, b.id);
    await expect(
      sb.financialAccount.update({ where: { id: accA.id }, data: { name: "przejęte" } }),
    ).rejects.toThrow();
    expect((await sb.financialAccount.updateMany({ data: { name: "x" } })).count).toBe(0);
    await expect(sb.transaction.delete({ where: { id: txA.id } })).rejects.toThrow();
    expect((await sb.transaction.deleteMany({})).count).toBe(0);
    expect(await base.transaction.count()).toBe(1);
    expect((await base.financialAccount.findUniqueOrThrow({ where: { id: accA.id } })).name).toBe(
      "Konto oszczędnościowe",
    );
  });

  it("nie da się dopisać transakcji do cudzego konta ani przenieść transakcji", async () => {
    const { a, b, accA, txA } = await twoUsers();
    const sb = scopedDb(base, b.id);
    await expect(
      sb.transaction.create({
        data: { accountId: accA.id, type: "DEPOSIT", date: day("2026-11-02"), amount: "1", currency: "PLN" },
      }),
    ).rejects.toBeInstanceOf(ScopeError);
    await expect(
      sb.transaction.createMany({
        data: [{ accountId: accA.id, type: "FEE", date: day("2026-11-02"), amount: "1", currency: "PLN" }],
      }),
    ).rejects.toBeInstanceOf(ScopeError);

    const accB = await scopedDb(base, b.id).financialAccount.create({
      data: { userId: b.id, name: "B", kind: "ASSET", type: "CASH", currency: "PLN" },
    });
    await expect(
      scopedDb(base, a.id).transaction.update({ where: { id: txA.id }, data: { accountId: accB.id } }),
    ).rejects.toBeInstanceOf(ScopeError);
  });

  it("tworzenie wymusza userId i blokuje podszycie się", async () => {
    const { a, b } = await twoUsers();
    const sb = scopedDb(base, b.id);
    await expect(
      sb.financialAccount.create({
        data: { userId: a.id, name: "X", kind: "ASSET", type: "CASH", currency: "PLN" },
      }),
    ).rejects.toBeInstanceOf(ScopeError);
    await expect(
      sb.financialAccount.updateMany({ where: {}, data: { userId: a.id } }),
    ).rejects.toBeInstanceOf(ScopeError);
    await expect(sb.user.delete({ where: { id: b.id } })).rejects.toBeInstanceOf(ScopeError);
    expect(await sb.user.findUnique({ where: { id: a.id } })).toBeNull();
    expect(await sb.user.findMany()).toHaveLength(1);
  });

  it("zagnieżdżone zapisy relacji są zablokowane", async () => {
    const { a, b, accA } = await twoUsers();
    const sb = scopedDb(base, b.id);
    await expect(
      sb.goal.create({
        data: {
          userId: b.id,
          name: "cel",
          kind: "SAVINGS",
          targetAmount: "1",
          accounts: { create: [{ accountId: accA.id }] },
        },
      }),
    ).rejects.toBeInstanceOf(ScopeError);
    const goalB = await sb.goal.create({
      data: { userId: b.id, name: "cel", kind: "SAVINGS", targetAmount: "1" },
    });
    await expect(
      sb.goalAccount.create({ data: { goalId: goalB.id, accountId: accA.id } }),
    ).rejects.toBeInstanceOf(ScopeError);
    expect(a.id).not.toBe(b.id);
  });

  it("katalog instrumentów: wspólny do odczytu, własny tylko dla właściciela", async () => {
    const { a, b } = await twoUsers();
    const shared = await base.asset.create({
      data: { name: "ETF wspólny", assetClass: "ETF", currency: "EUR" },
    });
    const own = await scopedDb(base, a.id).asset.create({
      data: { name: "Fundusz Anny", assetClass: "FUND", currency: "PLN" },
    });
    expect(own.userId).toBe(a.id);
    const sb = scopedDb(base, b.id);
    expect((await sb.asset.findMany()).map((x) => x.id)).toEqual([shared.id]);
    await expect(sb.asset.update({ where: { id: shared.id }, data: { name: "zmiana" } })).rejects.toThrow();
    await expect(sb.asset.update({ where: { id: own.id }, data: { name: "zmiana" } })).rejects.toThrow();
  });

  it("tabele globalne tylko do odczytu", async () => {
    const { b } = await twoUsers();
    const sb = scopedDb(base, b.id);
    expect(await sb.fxRate.findMany()).toEqual([]);
    await expect(
      sb.fxRate.create({
        data: { date: day("2026-11-02"), currency: "EUR", ratePln: "4.2648", table: "A", source: "test" },
      }),
    ).rejects.toBeInstanceOf(ScopeError);
  });

  it("kwoty wracają z bazy jako Decimal bez utraty precyzji", async () => {
    const { a, accA } = await twoUsers();
    await base.transaction.create({
      data: {
        accountId: accA.id,
        type: "DEPOSIT",
        date: day("2026-11-02"),
        amount: "12345678901234.5678",
        currency: "PLN",
      },
    });
    const sum = await scopedDb(base, a.id).transaction.aggregate({ _sum: { amount: true } });
    expect(sum._sum.amount?.toString()).toBe("12345678901334.5678");
  });

  it("scopedTransaction: rekord nadrzędny z tej samej transakcji jest widoczny, cudzy nadal nie", async () => {
    const { a, b, accA } = await twoUsers();
    const sa = scopedDb(base, a.id);
    const created = await scopedTransaction(sa, async (tx) => {
      const acc = await tx.financialAccount.create({
        data: { userId: a.id, name: "Nowe", kind: "ASSET", type: "CHECKING", currency: "PLN" },
      });
      await tx.transaction.create({
        data: { accountId: acc.id, type: "DEPOSIT", date: day("2026-11-02"), amount: "1", currency: "PLN" },
      });
      return acc;
    });
    expect(await base.transaction.count({ where: { accountId: created.id } })).toBe(1);
    const sb = scopedDb(base, b.id);
    await expect(
      scopedTransaction(sb, (tx) =>
        tx.transaction.create({
          data: {
            accountId: accA.id,
            type: "DEPOSIT",
            date: day("2026-11-02"),
            amount: "1",
            currency: "PLN",
          },
        }),
      ),
    ).rejects.toBeInstanceOf(ScopeError);
    // nieudana transakcja niczego nie zostawia
    await expect(
      scopedTransaction(sa, async (tx) => {
        await tx.financialAccount.create({
          data: { userId: a.id, name: "Wycofane", kind: "ASSET", type: "CASH", currency: "PLN" },
        });
        throw new Error("przerwij");
      }),
    ).rejects.toThrow("przerwij");
    expect(await base.financialAccount.count({ where: { name: "Wycofane" } })).toBe(0);
  });
});
