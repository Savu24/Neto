import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { scopedDb } from "@/lib/db/scoped";
import { resetDb, testDb } from "../../../../tests/db";
import { parseAccountInput } from "./account-input";
import { parseTransactionInput } from "./input";
import { loadNetWorthSeries, seriesDates } from "./net-worth-series";
import { createAccount, recordTransaction, type Ledger } from "./service";

const base = testDb();
const today = "2026-11-03";

async function user(email: string): Promise<Ledger> {
  const u = await base.user.create({ data: { email } });
  return { db: scopedDb(base, u.id), userId: u.id, today };
}

beforeEach(() => resetDb(base));
afterAll(() => base.$disconnect());

describe("seriesDates", () => {
  it("dzień przed startem, końce miesięcy i ostatnie 31 dni", () => {
    const dates = seriesDates("2026-08-15", today);
    expect(dates[0]).toBe("2026-08-14");
    expect(dates).toContain("2026-08-31");
    expect(dates).toContain("2026-09-30");
    expect(dates).toContain("2026-10-04");
    expect(dates).not.toContain("2026-10-02");
    expect(dates.at(-1)).toBe(today);
    expect(new Set(dates).size).toBe(dates.length);
    expect([...dates].sort()).toEqual(dates);
  });

  it("najwyżej 10 lat wstecz", () => {
    expect(seriesDates("1990-01-01", today)[0]).toBe("2016-11-02");
  });
});

describe("loadNetWorthSeries", () => {
  it("historia z sald i kredytu, alokacja na dziś", async () => {
    const l = await user("a@example.com");
    const konto = await createAccount(
      l,
      parseAccountInput(
        {
          name: "Konto",
          type: "CHECKING",
          currency: "PLN",
          openingAmount: "10000",
          openingDate: "2026-08-01",
        },
        today,
        "create",
      ),
    );
    await recordTransaction(
      l,
      parseTransactionInput(
        { accountId: konto.id, type: "BALANCE_SET", amount: "12500", date: "2026-10-15" },
        today,
      ),
    );
    await createAccount(
      l,
      parseAccountInput(
        { name: "Kredyt", type: "LOAN", currency: "PLN", openingAmount: "3000", openingDate: "2026-09-10" },
        today,
        "create",
      ),
    );

    const s = await loadNetWorthSeries(l.db, today);
    const at = (d: string) => s.points.find((p) => p.date === d);
    expect(s.points[0]).toMatchObject({ date: "2026-07-31", netWorth: "0" });
    expect(at("2026-08-31")).toMatchObject({ assets: "10000", liabilities: "0", netWorth: "10000" });
    expect(at("2026-09-30")).toMatchObject({ assets: "10000", liabilities: "3000", netWorth: "7000" });
    expect(at(today)).toMatchObject({ assets: "12500", liabilities: "3000", netWorth: "9500" });
    expect(s.byClass).toEqual({ CASH: "12500" });
    expect(s.byAccount[konto.id]).toBe("12500");
  });

  it("bez kont pusto; cudzych danych nie widać", async () => {
    const a = await user("b@example.com");
    const b = await user("c@example.com");
    await createAccount(
      b,
      parseAccountInput(
        { name: "Cudze", type: "SAVINGS", currency: "PLN", openingAmount: "5" },
        today,
        "create",
      ),
    );
    expect(await loadNetWorthSeries(a.db, today)).toEqual({
      points: [],
      byClass: {},
      byCurrency: {},
      byAccount: {},
    });
  });
});
