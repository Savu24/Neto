import { D, Dec, type DecInput } from "@/lib/money";
import { daysBetween, type DateKey } from "./dates";
import { sortedByDate } from "./series";

/**
 * XIRR (SPEC 7.6): roczna stopa r, dla której Σ a_i × (1 + r)^(−t_i) = 0, t_i = dni od pierwszego przepływu / 365.
 * Znak z perspektywy inwestora: wpłata do portfela < 0, wypłata i wartość końcowa > 0.
 *
 * Metoda: najpierw szukamy przedziału [lo, hi] ze zmianą znaku, potem Newton zabezpieczony bisekcją
 * (krok Newtona tylko, gdy zostaje w przedziale i szybko zawęża). Brak przedziału lub brak zbieżności
 * → `null`, a interfejs pokazuje „—”.
 *
 * Liczymy na Decimal z precyzją 20 cyfr: wynik to stopa (pokazywana z 1–2 miejscami), a potęgi
 * ułamkowe przy 40 cyfrach są kilkadziesiąt razy wolniejsze.
 */
const X = Dec.clone({ precision: 20 });
type X = InstanceType<typeof X>;

export interface XirrFlow {
  readonly date: DateKey;
  readonly amount: DecInput;
}

export interface XirrOptions {
  /** Tolerancja stopy (domyślnie 1e-9). */
  readonly tolerance?: DecInput;
  readonly maxIterations?: number;
}

export function xirr(flows: readonly XirrFlow[], opts: XirrOptions = {}): Dec | null {
  const sorted = sortedByDate(flows).filter((f) => !D(f.amount).isZero());
  if (sorted.length < 2) return null;
  const hasNegative = sorted.some((f) => D(f.amount).lt(0));
  const hasPositive = sorted.some((f) => D(f.amount).gt(0));
  if (!hasNegative || !hasPositive) return null;

  const t0 = sorted[0].date;
  const points = sorted.map((f) => ({
    a: new X(D(f.amount).toString()),
    t: new X(daysBetween(t0, f.date)).div(365),
  }));
  if (points.every((p) => p.t.isZero())) return null;

  const tol = new X(D(opts.tolerance ?? "1e-9").toString());
  const maxIter = opts.maxIterations ?? 200;

  // f(r) i f'(r) przez ln(1+r): (1+r)^(−t) = exp(−t·ln(1+r)).
  const evaluate = (r: X): { f: X; df: X } => {
    const ln = r.plus(1).ln();
    let f = new X(0);
    let df = new X(0);
    for (const { a, t } of points) {
      const disc = t.neg().times(ln).exp();
      f = f.plus(a.times(disc));
      df = df.minus(t.times(a).times(disc).div(r.plus(1)));
    }
    return { f, df };
  };

  const bracket = findBracket(evaluate);
  if (!bracket) return null;
  if (!Array.isArray(bracket)) return D(bracket.toString());
  let [lo, hi] = bracket;
  let fLo = evaluate(lo).f;
  let r = lo.plus(hi).div(2);
  let prevStep = hi.minus(lo).abs();

  for (let i = 0; i < maxIter; i++) {
    const { f, df } = evaluate(r);
    if (f.isZero()) return D(r.toString());
    if (f.isNeg() === fLo.isNeg()) {
      lo = r;
      fLo = f;
    } else {
      hi = r;
    }
    let next: X | null = null;
    if (!df.isZero()) {
      const candidate = r.minus(f.div(df));
      const step = candidate.minus(r).abs();
      if (candidate.gt(lo) && candidate.lt(hi) && step.lt(prevStep.div(2))) {
        next = candidate;
        prevStep = step;
      }
    }
    if (!next) {
      next = lo.plus(hi).div(2);
      prevStep = hi.minus(lo).div(2);
    }
    if (next.minus(r).abs().lte(tol)) return D(next.toString());
    r = next;
  }
  return null;
}

/** Przedział ze zmianą znaku f albo od razu pierwiastek, gdy trafimy w niego na siatce. */
function findBracket(evaluate: (r: X) => { f: X }): [X, X] | X | null {
  // Siatka od −99,9999% do 1 000 000% rocznie; pierwsza zmiana znaku wyznacza przedział.
  const grid = [
    "-0.999999",
    "-0.99",
    "-0.9",
    "-0.5",
    "-0.2",
    "0",
    "0.1",
    "0.25",
    "0.5",
    "1",
    "3",
    "10",
    "100",
    "1000",
    "1000000",
  ].map((v) => new X(v));
  let prev: X | null = null;
  let fPrev: X | null = null;
  for (const r of grid) {
    const f = safeEval(evaluate, r);
    if (f !== null && f.isZero()) return r;
    if (prev && fPrev !== null && f !== null && f.isNeg() !== fPrev.isNeg()) return [prev, r];
    prev = r;
    fPrev = f;
  }
  return null;
}

function safeEval(evaluate: (r: X) => { f: X }, r: X): X | null {
  const { f } = evaluate(r);
  return f.isFinite() ? f : null;
}

export interface PortfolioFlow {
  readonly date: DateKey;
  /** Z perspektywy portfela: wpłata > 0, wypłata < 0. */
  readonly amount: DecInput;
}

export interface PortfolioXirrInput {
  /** Wpłaty i wypłaty z/do kont inwestycyjnych (maklerskie, emerytalne, krypto, obligacje). */
  readonly flows: readonly PortfolioFlow[];
  readonly endDate: DateKey;
  readonly endValue: DecInput;
  /** Okres częściowy (np. ostatnie 12 miesięcy): wartość początkowa jako przepływ ujemny w dniu startu. */
  readonly start?: { readonly date: DateKey; readonly value: DecInput };
}

/** XIRR portfela (SPEC 7.6): od początku albo od `start.date` (bez przepływów z tego dnia i wcześniej). */
export function portfolioXirr({ flows, endDate, endValue, start }: PortfolioXirrInput): Dec | null {
  const inRange = flows.filter((f) => f.date <= endDate && (!start || f.date > start.date));
  const xFlows: XirrFlow[] = inRange.map((f) => ({ date: f.date, amount: D(f.amount).neg() }));
  if (start) xFlows.unshift({ date: start.date, amount: D(start.value).neg() });
  xFlows.push({ date: endDate, amount: D(endValue) });
  return xirr(xFlows);
}
