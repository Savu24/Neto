import type { ScopedDb } from "@/lib/db/scoped";
import { loadPortfolio } from "@/lib/portfolio/ledger/load";
import type { LinkableAccount } from "./goal-form";

/** Dane do formularza celu: konta do powiązania (aktywa, bez zobowiązań) i wartość netto do podglądu. */
export async function goalFormData(db: ScopedDb, today: string) {
  const portfolio = await loadPortfolio(db, today);
  const accounts: LinkableAccount[] = portfolio.accounts
    .filter((a) => a.kind !== "LIABILITY")
    .map((a) => ({ id: a.id, name: a.name, valuePln: a.valuePln }));
  return { portfolio, accounts, netWorth: portfolio.netWorth };
}
