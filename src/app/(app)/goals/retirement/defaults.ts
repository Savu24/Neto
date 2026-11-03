import "server-only";
import type { ScopedDb } from "@/lib/db/scoped";
import { D, sum } from "@/lib/money";
import { loadPortfolio } from "@/lib/portfolio/ledger/load";
import { todayKey } from "@/lib/portfolio/valuation";
import { specDefaults, type AssumptionValues } from "./assumptions";

/**
 * Założenia startowe kalkulatora dla zalogowanego użytkownika (SPEC 7.11):
 * - zapisany `RetirementPlan` nadpisuje pola, które przechowuje;
 * - `currentAge`: rok bieżący − `User.birthYear`, inaczej puste;
 * - `startingCapital`: bieżąca wartość aktywów bez nieruchomości i pojazdów (przełącznik `includeHome`
 *   w planie dolicza nieruchomości). Liczone na bieżąco, nie z migawek.
 */
const pct = (v: { toString(): string }) => D(v.toString()).times(100).toFixed();

export async function loadRetirementDefaults(db: ScopedDb, userId: string): Promise<AssumptionValues> {
  const today = todayKey();
  const [plan, user, portfolio] = await Promise.all([
    db.retirementPlan.findUnique({ where: { userId } }),
    db.user.findUnique({ where: { id: userId }, select: { birthYear: true } }),
    loadPortfolio(db, today),
  ]);
  const includeHome = plan?.includeHome ?? false;
  const capital = sum(
    portfolio.accounts
      .filter((a) => a.kind === "ASSET" && a.includeInNetWorth)
      .filter((a) => a.group !== "property" || (includeHome && a.type === "REAL_ESTATE"))
      .map((a) => a.valuePln),
  );
  const year = Number(today.slice(0, 4));
  return {
    ...specDefaults,
    currentAge: user?.birthYear ? String(year - user.birthYear) : "",
    startingCapital: capital.toDecimalPlaces(0).toFixed(),
    ...(plan
      ? {
          retireAge: String(plan.retireAge),
          monthlyContribution: plan.monthlyContribution.toString(),
          monthlySpending: D(plan.monthlySpending.toString()).isZero() ? "" : plan.monthlySpending.toString(),
          zusMonthly: plan.zusMonthly.toString(),
          withdrawalRate: pct(plan.withdrawalRate),
          returnLow: pct(plan.returnLow),
          returnBase: pct(plan.returnBase),
          returnHigh: pct(plan.returnHigh),
          inflation: pct(plan.inflation),
        }
      : {}),
  };
}
