import { scopedTransaction, type ScopedDb } from "@/lib/db/scoped";
import { D, Dec, sum } from "@/lib/money";
import type { GoalInput, GoalSource } from "./goal-input";
import { goalProgress, savingsPlan, type SavingsPlan } from "./goals";
import type { PortfolioView } from "./ledger/load";

/**
 * Zapis i odczyt celów (HU-5.1, 5.2). Wyłącznie przez scopedDb; powiązania z kontami osobnym wywołaniem
 * (zagnieżdżone zapisy są zablokowane). Jeden cel główny: zaznaczenie nowego zdejmuje znacznik z innych.
 */

const dateFromKey = (key: string) => new Date(`${key}T00:00:00Z`);
const keyFromDate = (date: Date) => date.toISOString().slice(0, 10);

export class GoalNotFoundError extends Error {
  constructor() {
    super("Nie znaleziono celu");
    this.name = "GoalNotFoundError";
  }
}

function goalData(input: GoalInput) {
  return {
    name: input.name,
    kind: input.source === "netWorth" ? ("NET_WORTH" as const) : ("SAVINGS" as const),
    targetAmount: input.targetAmount,
    targetDate: input.targetDate ? dateFromKey(input.targetDate) : null,
    savedAmount: input.source === "manual" ? input.savedAmount : null,
    isMain: input.isMain,
  };
}

/** Konta do powiązania: tylko własne, niezarchiwizowane aktywa (bez zobowiązań). */
async function linkableAccountIds(db: ScopedDb, ids: readonly string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db.financialAccount.findMany({
    where: { id: { in: [...ids] }, archivedAt: null, kind: { not: "LIABILITY" } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function createGoal(db: ScopedDb, userId: string, input: GoalInput): Promise<string> {
  const accountIds = await linkableAccountIds(db, input.accountIds);
  return scopedTransaction(db, async (tx) => {
    if (input.isMain) await tx.goal.updateMany({ where: { isMain: true }, data: { isMain: false } });
    const goal = await tx.goal.create({ data: { userId, ...goalData(input) } });
    if (accountIds.length > 0)
      await tx.goalAccount.createMany({
        data: accountIds.map((accountId) => ({ goalId: goal.id, accountId })),
      });
    return goal.id;
  });
}

export async function updateGoal(db: ScopedDb, goalId: string, input: GoalInput): Promise<void> {
  const accountIds = await linkableAccountIds(db, input.accountIds);
  await scopedTransaction(db, async (tx) => {
    const existing = await tx.goal.findUnique({ where: { id: goalId }, select: { id: true } });
    if (!existing) throw new GoalNotFoundError();
    if (input.isMain)
      await tx.goal.updateMany({ where: { isMain: true, id: { not: goalId } }, data: { isMain: false } });
    await tx.goal.update({ where: { id: goalId }, data: goalData(input) });
    await tx.goalAccount.deleteMany({ where: { goalId } });
    if (accountIds.length > 0)
      await tx.goalAccount.createMany({ data: accountIds.map((accountId) => ({ goalId, accountId })) });
  });
}

export async function deleteGoal(db: ScopedDb, goalId: string): Promise<void> {
  const { count } = await db.goal.deleteMany({ where: { id: goalId } });
  if (count === 0) throw new GoalNotFoundError();
}

export interface GoalView {
  readonly id: string;
  readonly name: string;
  readonly source: GoalSource;
  readonly targetAmount: string;
  readonly targetDate: string | null;
  readonly savedAmount: string | null;
  readonly isMain: boolean;
  readonly accountIds: readonly string[];
  /** Nazwy powiązanych kont (do opisu źródła). */
  readonly accountNames: readonly string[];
  /** Bieżąca wartość w PLN. */
  readonly current: string;
  /** Postęp jako ułamek, przycięty do 0..1 na pasek; null przy celu 0. */
  readonly progress: string | null;
  readonly plan: SavingsPlan;
}

/** Cele użytkownika z bieżącą wartością i planem; cel główny pierwszy. */
export async function loadGoals(db: ScopedDb, portfolio: PortfolioView, today: string): Promise<GoalView[]> {
  const goals = await db.goal.findMany({
    include: { accounts: { select: { accountId: true } } },
    orderBy: [{ isMain: "desc" }, { createdAt: "asc" }],
  });
  const accounts = new Map(portfolio.accounts.map((a) => [a.id, a]));
  return goals.map((g) => {
    const accountIds = g.accounts.map((a) => a.accountId);
    const source: GoalSource =
      g.kind === "NET_WORTH" ? "netWorth" : accountIds.length > 0 ? "accounts" : "manual";
    const linked = accountIds.flatMap((id) => {
      const a = accounts.get(id);
      return a ? [a] : [];
    });
    const current =
      source === "netWorth"
        ? D(portfolio.netWorth)
        : source === "accounts"
          ? sum(linked.map((a) => a.valuePln))
          : D(g.savedAmount?.toString() ?? 0);
    const target = g.targetAmount.toString();
    const deadline = g.targetDate ? keyFromDate(g.targetDate) : null;
    const progress = goalProgress(current, target);
    return {
      id: g.id,
      name: g.name,
      source,
      targetAmount: target,
      targetDate: deadline,
      savedAmount: g.savedAmount?.toString() ?? null,
      isMain: g.isMain,
      accountIds,
      accountNames: linked.map((a) => a.name),
      current: current.toFixed(),
      progress: progress === null ? null : Dec.min(Dec.max(progress, 0), 1).toFixed(),
      plan: savingsPlan(current, target, today, deadline),
    };
  });
}
