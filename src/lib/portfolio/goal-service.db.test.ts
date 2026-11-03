import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { scopedDb } from "@/lib/db/scoped";
import { resetDb, testDb } from "../../../tests/db";
import { parseGoalInput } from "./goal-input";
import { createGoal, deleteGoal, GoalNotFoundError, loadGoals, updateGoal } from "./goal-service";
import { parseAccountInput } from "./ledger/account-input";
import { loadPortfolio } from "./ledger/load";
import { createAccount } from "./ledger/service";

const base = testDb();
const today = "2026-11-03";

async function user(email: string) {
  const u = await base.user.create({ data: { email } });
  return { db: scopedDb(base, u.id), userId: u.id, today };
}

const goal = (fields: Record<string, string>, accountIds: string[] = []) =>
  parseGoalInput(fields, accountIds, today);

async function goals(l: Awaited<ReturnType<typeof user>>) {
  return loadGoals(l.db, await loadPortfolio(l.db, today), today);
}

beforeEach(() => resetDb(base));
afterAll(() => base.$disconnect());

describe("cele", () => {
  it("cel od zera liczy plan, a kolejne odłożone kwoty go zmniejszają", async () => {
    const l = await user("a@example.com");
    const id = await createGoal(
      l.db,
      l.userId,
      goal({ name: "Samochód", targetAmount: "50000", targetDate: "2029-11-03" }),
    );
    let [g] = await goals(l);
    expect(g).toMatchObject({ id, source: "manual", current: "0", progress: "0" });
    expect(g.plan.kind === "plan" && g.plan.perMonth?.toFixed(2)).toBe("1388.89");

    await updateGoal(
      l.db,
      id,
      goal({ name: "Samochód", targetAmount: "50000", targetDate: "2029-11-03", savedAmount: "14000" }),
    );
    [g] = await goals(l);
    expect(g.current).toBe("14000");
    expect(g.plan.kind === "plan" && g.plan.perMonth?.toFixed()).toBe("1000");
  });

  it("postęp z wybranych kont i z wartości netto", async () => {
    const l = await user("b@example.com");
    const savings = await createAccount(
      l,
      parseAccountInput(
        { name: "Oszczędności", type: "SAVINGS", currency: "PLN", openingAmount: "6000" },
        today,
        "create",
      ),
    );
    await createAccount(
      l,
      parseAccountInput(
        { name: "Konto", type: "CHECKING", currency: "PLN", openingAmount: "4000" },
        today,
        "create",
      ),
    );
    await createGoal(
      l.db,
      l.userId,
      goal({ name: "Z konta", targetAmount: "12000", source: "accounts" }, [savings.id]),
    );
    await createGoal(l.db, l.userId, goal({ name: "Netto", targetAmount: "20000", source: "netWorth" }));
    const [fromAccount, fromNet] = await goals(l);
    expect(fromAccount).toMatchObject({
      source: "accounts",
      current: "6000",
      progress: "0.5",
      accountNames: ["Oszczędności"],
    });
    expect(fromNet).toMatchObject({ source: "netWorth", current: "10000" });
  });

  it("tylko jeden cel główny i jest pierwszy", async () => {
    const l = await user("c@example.com");
    await createGoal(l.db, l.userId, goal({ name: "Pierwszy", targetAmount: "1", isMain: "on" }));
    await createGoal(l.db, l.userId, goal({ name: "Drugi", targetAmount: "1", isMain: "on" }));
    const list = await goals(l);
    expect(list.map((g) => [g.name, g.isMain])).toEqual([
      ["Drugi", true],
      ["Pierwszy", false],
    ]);
  });

  it("cudzych celów i kont nie widać ani nie da się zmienić", async () => {
    const a = await user("d@example.com");
    const b = await user("e@example.com");
    const foreignAccount = await createAccount(
      b,
      parseAccountInput(
        { name: "Cudze", type: "SAVINGS", currency: "PLN", openingAmount: "999" },
        today,
        "create",
      ),
    );
    const id = await createGoal(
      a.db,
      a.userId,
      goal({ name: "Mój", targetAmount: "100", source: "accounts" }, [foreignAccount.id]),
    );
    expect((await goals(a))[0]).toMatchObject({ source: "manual", accountIds: [] });
    expect(await goals(b)).toEqual([]);
    await expect(updateGoal(b.db, id, goal({ name: "X", targetAmount: "1" }))).rejects.toBeInstanceOf(
      GoalNotFoundError,
    );
    await expect(deleteGoal(b.db, id)).rejects.toBeInstanceOf(GoalNotFoundError);
    await deleteGoal(a.db, id);
    expect(await goals(a)).toEqual([]);
  });
});
