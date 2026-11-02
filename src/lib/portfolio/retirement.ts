import { D, Dec, ZERO, type DecInput } from "@/lib/money";

/**
 * Kalkulator emerytury (SPEC 7.11). Wszystko w wartościach realnych (dzisiejsze złote),
 * kapitalizacja miesięczna, wpłata na koniec miesiąca. Inflacja służy tylko do pokazania kwot nominalnych.
 */

/** Ostatni wiek, dla którego liczymy kapitał i szukamy najwcześniejszego wieku emerytalnego. */
export const HORIZON_AGE = 80;

export const scenarioKeys = ["low", "base", "high"] as const;
export type ScenarioKey = (typeof scenarioKeys)[number];

export type RetirementInput = {
  currentAge: number;
  retireAge: number;
  startingCapital: DecInput;
  monthlyContribution: DecInput;
  /** Wydatki miesięczne na emeryturze w dzisiejszych złotych; null = jeszcze niewpisane. */
  monthlySpending: DecInput | null;
  zusMonthly: DecInput;
  /** Stopa wypłaty rocznie jako ułamek (0,04 = 4%). */
  withdrawalRate: DecInput;
  /** Realne roczne stopy zwrotu jako ułamki. */
  returns: Record<ScenarioKey, DecInput>;
  /** Roczna inflacja jako ułamek, tylko do kwot nominalnych. */
  inflation: DecInput;
};

export type CapitalPoint = { age: number; capital: Dec };

export type ScenarioResult = {
  annualReturn: Dec;
  /** Kapitał co rok życia, od wieku obecnego do 80. */
  series: CapitalPoint[];
  capitalAtRetirement: Dec;
  /** null, gdy wydatki nie są wpisane. */
  sufficient: boolean | null;
  /** Najwcześniejszy wiek ≤ 80 z kapitałem ≥ potrzebny; null = nie w tym horyzoncie (albo brak wydatków). */
  earliestAge: number | null;
};

export type RetirementResult = {
  requiredCapital: Dec | null;
  scenarios: Record<ScenarioKey, ScenarioResult>;
};

/** r_m = (1 + r)^(1/12) − 1 */
export function monthlyRate(annualRate: DecInput): Dec {
  const r = D(annualRate);
  if (r.lte(-1)) throw new RangeError("Stopa zwrotu musi być większa niż −100%");
  if (r.isZero()) return ZERO;
  return r.plus(1).pow(D(1).div(12)).minus(1);
}

/** FV(n) = PV × (1 + r_m)^n + PMT × ((1 + r_m)^n − 1) / r_m; dla r_m = 0: PV + PMT × n. */
export function futureValue(pv: DecInput, pmt: DecInput, rm: DecInput, months: number): Dec {
  if (!Number.isInteger(months) || months < 0) throw new RangeError("Liczba miesięcy musi być całkowita ≥ 0");
  const rate = D(rm);
  if (rate.isZero()) return D(pv).plus(D(pmt).times(months));
  const growth = rate.plus(1).pow(months);
  return D(pv)
    .times(growth)
    .plus(D(pmt).times(growth.minus(1)).div(rate));
}

/** Potrzebny kapitał = 12 × max(0, wydatki − ZUS) ÷ stopa wypłaty. */
export function requiredCapital(
  monthlySpending: DecInput,
  zusMonthly: DecInput,
  withdrawalRate: DecInput,
): Dec {
  const wr = D(withdrawalRate);
  if (wr.lte(0)) throw new RangeError("Stopa wypłaty musi być dodatnia");
  const gap = Dec.max(ZERO, D(monthlySpending).minus(D(zusMonthly)));
  return gap.times(12).div(wr);
}

/** Kwota realna przeliczona na nominalną po `years` latach inflacji. */
export function toNominal(real: DecInput, inflation: DecInput, years: number): Dec {
  return D(real).times(D(inflation).plus(1).pow(years));
}

export function validateInput(input: RetirementInput): void {
  const { currentAge, retireAge } = input;
  if (!Number.isInteger(currentAge) || currentAge < 0 || currentAge > HORIZON_AGE) {
    throw new RangeError(`Wiek obecny musi być liczbą całkowitą od 0 do ${HORIZON_AGE}`);
  }
  if (!Number.isInteger(retireAge) || retireAge < currentAge || retireAge > HORIZON_AGE) {
    throw new RangeError(`Wiek emerytalny musi być liczbą całkowitą od wieku obecnego do ${HORIZON_AGE}`);
  }
  for (const [name, value] of [
    ["startingCapital", input.startingCapital],
    ["monthlyContribution", input.monthlyContribution],
    ["zusMonthly", input.zusMonthly],
  ] as const) {
    if (D(value).isNeg()) throw new RangeError(`${name} nie może być ujemne`);
  }
  if (input.monthlySpending !== null && D(input.monthlySpending).isNeg()) {
    throw new RangeError("monthlySpending nie może być ujemne");
  }
}

export function calculateRetirement(input: RetirementInput): RetirementResult {
  validateInput(input);
  const need =
    input.monthlySpending === null
      ? null
      : requiredCapital(input.monthlySpending, input.zusMonthly, input.withdrawalRate);

  const scenario = (key: ScenarioKey): ScenarioResult => {
    const annualReturn = D(input.returns[key]);
    const rm = monthlyRate(annualReturn);
    const series: CapitalPoint[] = [];
    for (let age = input.currentAge; age <= HORIZON_AGE; age++) {
      const months = (age - input.currentAge) * 12;
      series.push({
        age,
        capital: futureValue(input.startingCapital, input.monthlyContribution, rm, months),
      });
    }
    const capitalAtRetirement = series[input.retireAge - input.currentAge].capital;
    return {
      annualReturn,
      series,
      capitalAtRetirement,
      sufficient: need === null ? null : capitalAtRetirement.gte(need),
      earliestAge: need === null ? null : (series.find((p) => p.capital.gte(need))?.age ?? null),
    };
  };

  return {
    requiredCapital: need,
    scenarios: { low: scenario("low"), base: scenario("base"), high: scenario("high") },
  };
}
