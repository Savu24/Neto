import { D, type Dec, type DecInput } from "@/lib/money";

/**
 * Cele oszczędnościowe i cele wartości netto (SPEC 7.10). Czyste funkcje, kwoty jako Decimal.
 * Bieżąca wartość to suma powiązanych kont albo cała wartość netto; liczy ją wywołujący.
 */

/** Postęp jako ułamek (0,87 = 87%). Przy celu ≤ 0 procentu nie ma, więc null. */
export function goalProgress(current: DecInput, target: DecInput): Dec | null {
  const t = D(target);
  if (t.lte(0)) return null;
  return D(current).div(t);
}

/** Liczba pełnych miesięcy od `today` do `deadline` (daty kalendarzowe YYYY-MM-DD). Minimum 0. */
export function fullMonthsBetween(today: string, deadline: string): number {
  const [y1, m1, d1] = parseDateKey(today);
  const [y2, m2, d2] = parseDateKey(deadline);
  let months = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1) months -= 1;
  return Math.max(0, months);
}

function parseDateKey(key: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) throw new Error(`Niepoprawna data: ${key}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export type RequiredContribution =
  | { kind: "achieved" }
  | { kind: "noDeadline" }
  /** Termin minął albo został mniej niż pełny miesiąc: brakuje `remaining`, nie ma na co dzielić. */
  | { kind: "deadlinePassed"; remaining: Dec }
  | { kind: "monthly"; amount: Dec; months: number };

/**
 * Potrzebna wpłata miesięczna = (cel − bieżąca wartość) ÷ pełne miesiące do terminu.
 * Bez zakładanej stopy zwrotu (ekran pokazuje o tym dopisek).
 */
export function requiredMonthlyContribution(
  current: DecInput,
  target: DecInput,
  months: number | null,
): RequiredContribution {
  const remaining = D(target).minus(D(current));
  if (remaining.lte(0)) return { kind: "achieved" };
  if (months === null) return { kind: "noDeadline" };
  if (months <= 0) return { kind: "deadlinePassed", remaining };
  return { kind: "monthly", amount: remaining.div(months), months };
}

/** Średni miesięczny przyrost z ostatnich `months` miesięcy (domyślnie 3). */
export function averageMonthlyGrowth(current: DecInput, valueMonthsAgo: DecInput, months = 3): Dec {
  if (months <= 0) throw new Error("Liczba miesięcy musi być dodatnia");
  return D(current).minus(D(valueMonthsAgo)).div(months);
}

export type GoalPace =
  | { kind: "onTrack" }
  /** Poniżej tempa o `shortfall` zł miesięcznie. Bez słów ocennych w interfejsie. */
  | { kind: "behind"; shortfall: Dec }
  /** Brak historii albo brak wymaganej wpłaty do porównania. */
  | { kind: "unknown" };

/** Tempo: średni przyrost ≥ potrzebna wpłata → w dobrym tempie, inaczej różnica na miesiąc. */
export function goalPace(required: RequiredContribution, averageGrowth: DecInput | null): GoalPace {
  if (required.kind === "achieved") return { kind: "onTrack" };
  if (required.kind !== "monthly" || averageGrowth === null) return { kind: "unknown" };
  const growth = D(averageGrowth);
  if (growth.gte(required.amount)) return { kind: "onTrack" };
  return { kind: "behind", shortfall: required.amount.minus(growth) };
}

export type GoalInput = {
  current: DecInput;
  target: DecInput;
  /** Termin YYYY-MM-DD albo null (cel bez terminu). */
  deadline: string | null;
  /** Dzisiejsza data YYYY-MM-DD w strefie Europe/Warsaw. */
  today: string;
  /** Wartość sprzed 3 miesięcy (z migawek) albo null, gdy historii jeszcze nie ma. */
  valueThreeMonthsAgo: DecInput | null;
};

export type GoalStatus = {
  progress: Dec | null;
  required: RequiredContribution;
  averageGrowth: Dec | null;
  pace: GoalPace;
};

export function evaluateGoal(input: GoalInput): GoalStatus {
  const months = input.deadline === null ? null : fullMonthsBetween(input.today, input.deadline);
  const required = requiredMonthlyContribution(input.current, input.target, months);
  const averageGrowth =
    input.valueThreeMonthsAgo === null
      ? null
      : averageMonthlyGrowth(input.current, input.valueThreeMonthsAgo);
  return {
    progress: goalProgress(input.current, input.target),
    required,
    averageGrowth,
    pace: goalPace(required, averageGrowth),
  };
}
