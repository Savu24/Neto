import { D, ZERO, type Dec, type DecInput } from "@/lib/money";
import { addMonths, daysBetween, minDate, type DateKey } from "./dates";

/**
 * Lokata (SPEC 7.4). Przy kapitalizacji co k miesięcy, po n pełnych okresach:
 *   K × (1 + r·k/12)^n × (1 + r × dni_w_bieżącym_okresie / 365)
 * Kapitalizacja „na koniec okresu” to jeden okres równy całej lokacie. Granice okresów liczymy zawsze od
 * daty założenia (start + k·i miesięcy), żeby przycinanie końca miesiąca się nie kumulowało.
 * Gdy okres lokaty nie dzieli się przez k, ostatni niepełny okres jest liczony liniowo do terminu.
 *
 * Po terminie:
 * - bez odnawiania: wartość stoi na kwocie z terminu (bez dalszych odsetek), aż transakcja
 *   „zakończenie lokaty” przeniesie środki (`closedAt`); od tej daty wartość lokaty to 0;
 * - z odnawianiem: kolejny okres z tym samym oprocentowaniem, od kwoty z terminu, z flagą `checkRate`.
 * Wartość brutto, przed podatkiem 19%.
 */
export type Capitalization = "END" | "MONTHLY" | "QUARTERLY" | "ANNUAL";

export interface DepositInput {
  readonly principal: DecInput;
  /** Oprocentowanie roczne nominalne jako ułamek (6,5% = "0.065"). */
  readonly annualRate: DecInput;
  readonly startDate: DateKey;
  readonly termMonths: number;
  readonly capitalization: Capitalization;
  readonly autoRenew: boolean;
  /** Dzień przeniesienia środków po terminie (transakcja „zakończenie lokaty”). */
  readonly closedAt?: DateKey;
}

export type DepositStatus = "notStarted" | "active" | "matured" | "closed";

export interface DepositValuation {
  readonly value: Dec;
  readonly status: DepositStatus;
  /** 0 = pierwszy okres; > 0 = okres po odnowieniu. */
  readonly termIndex: number;
  readonly termStart: DateKey;
  readonly maturityDate: DateKey;
  /** Odnowiona lokata: oprocentowanie przyjęte z poprzedniego okresu, użytkownik powinien je sprawdzić. */
  readonly checkRate: boolean;
}

const CAP_MONTHS: Record<Exclude<Capitalization, "END">, number> = { MONTHLY: 1, QUARTERLY: 3, ANNUAL: 12 };

function capitalizationMonths(dep: DepositInput): number {
  return dep.capitalization === "END" ? dep.termMonths : CAP_MONTHS[dep.capitalization];
}

/** Wartość jednego okresu lokaty od kwoty `amount` założonej `start`, w dniu `date` (≤ termin). */
function termValue(dep: DepositInput, amount: Dec, start: DateKey, date: DateKey): Dec {
  const r = D(dep.annualRate);
  const k = capitalizationMonths(dep);
  const maturity = addMonths(start, dep.termMonths);
  const end = minDate(date, maturity);
  const periodFactor = r.times(k).div(12).plus(1);

  let n = 0;
  let periodStart = start;
  for (;;) {
    const next = addMonths(start, k * (n + 1));
    if (next > maturity || next > end) break;
    n++;
    periodStart = next;
  }
  const linear = r.times(daysBetween(periodStart, end)).div(365).plus(1);
  return amount.times(periodFactor.pow(n)).times(linear);
}

export function depositMaturityDate(dep: DepositInput): DateKey {
  return addMonths(dep.startDate, dep.termMonths);
}

/** Kwota w dniu terminu pierwszego okresu (do transakcji „zakończenie lokaty”). */
export function depositMaturity(dep: DepositInput): { date: DateKey; amount: Dec } {
  const date = depositMaturityDate(dep);
  return { date, amount: termValue(dep, D(dep.principal), dep.startDate, date) };
}

export function depositValueAt(dep: DepositInput, date: DateKey): DepositValuation {
  if (!Number.isInteger(dep.termMonths) || dep.termMonths <= 0) {
    throw new RangeError("Okres lokaty musi być dodatnią liczbą miesięcy");
  }
  let amount = D(dep.principal);
  let termStart = dep.startDate;
  let termIndex = 0;
  let maturity = addMonths(termStart, dep.termMonths);
  const base = { termIndex, termStart, maturityDate: maturity, checkRate: false };

  if (date < dep.startDate) return { ...base, value: ZERO, status: "notStarted" };
  if (dep.closedAt !== undefined && date >= dep.closedAt) return { ...base, value: ZERO, status: "closed" };

  if (dep.autoRenew) {
    while (date >= maturity) {
      amount = termValue(dep, amount, termStart, maturity);
      termStart = maturity;
      termIndex++;
      maturity = addMonths(termStart, dep.termMonths);
    }
  }
  const value = termValue(dep, amount, termStart, date);
  const status: DepositStatus = date >= maturity ? "matured" : "active";
  return { value, status, termIndex, termStart, maturityDate: maturity, checkRate: termIndex > 0 };
}
