import "server-only";
import { specDefaults, type AssumptionValues } from "./assumptions";

/**
 * Punkt podpięcia danych z bazy (po Etapach 3–5). Na razie zwraca wartości domyślne z SPEC 7.11,
 * a majątek startowy wpisuje się ręcznie. Docelowo, dla zalogowanego użytkownika:
 * - zapisany `RetirementPlan` (jeśli jest) nadpisuje wszystkie pola poniżej;
 * - `currentAge`: rok bieżący (Europe/Warsaw) − `User.birthYear`, inaczej puste;
 * - `startingCapital`: wartość kont inwestycyjnych i oszczędnościowych z `PortfolioSnapshot`
 *   (bez nieruchomości mieszkalnej; przełącznik `RetirementPlan.includeHome`);
 * - `monthlyContribution`: średnia wpłat z 6 ostatnich miesięcy, inaczej 0.
 */
export async function loadRetirementDefaults(): Promise<AssumptionValues> {
  return { ...specDefaults };
}
