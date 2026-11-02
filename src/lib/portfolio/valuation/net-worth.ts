import { D, ZERO, type Dec, type DecInput } from "@/lib/money";
import { eachDay, type DateKey } from "./dates";
import { fxRateOn, type FxTable } from "./fx";
import { positionValueAt, type PositionInput, type PositionValue } from "./positions";
import { staleness, type Staleness } from "./staleness";

/**
 * Wartość netto na dzień D (SPEC 7.3):
 *   wartość w PLN = wartość w walucie × kurs z dnia D × udział własności konta
 *   wartość netto = Σ aktywa − Σ zobowiązania, tylko konta z „wliczaj do wartości netto”.
 * Pozycji bez wartości lub bez kursu nie wliczamy do sum, ale zgłaszamy je w `issues` (licznik na pulpicie).
 */

export type AccountKind = "ASSET" | "LIABILITY";

export interface AccountInput {
  readonly id: string;
  readonly kind: AccountKind;
  /** Udział własności 0–1 (np. "0.5" dla mieszkania na pół); domyślnie 1. */
  readonly ownershipShare?: DecInput;
  /** Domyślnie true. */
  readonly includeInNetWorth?: boolean;
  readonly positions: readonly PositionInput[];
}

export type ValuationIssue =
  | { readonly type: "stale"; readonly staleness: Staleness }
  | { readonly type: "missingPrice" }
  | { readonly type: "missingFx"; readonly currency: string }
  | { readonly type: "bondRateMissing" }
  | { readonly type: "depositCheckRate" };

export interface PositionValuation extends PositionValue {
  readonly id?: string;
  readonly assetClass: string;
  readonly fxRate: Dec | null;
  readonly fxDate: DateKey | null;
  /** Wartość w PLN przy 100% własności. */
  readonly valuePlnFull: Dec | null;
  /** Wartość w PLN po udziale własności. */
  readonly valuePln: Dec | null;
  readonly issues: readonly ValuationIssue[];
}

export interface AccountValuation {
  readonly id: string;
  readonly kind: AccountKind;
  readonly included: boolean;
  readonly ownershipShare: Dec;
  /** Suma pozycji z ustaloną wartością, po udziale własności (dodatnia także dla zobowiązań). */
  readonly valuePln: Dec;
  /** Czy wszystkie pozycje mają wartość w PLN. */
  readonly complete: boolean;
  readonly positions: readonly PositionValuation[];
}

export interface NetWorthResult {
  readonly date: DateKey;
  readonly assets: Dec;
  readonly liabilities: Dec;
  readonly netWorth: Dec;
  readonly accounts: readonly AccountValuation[];
  /** Aktywa w PLN według waluty pozycji (tylko konta wliczane). */
  readonly byCurrency: Readonly<Record<string, Dec>>;
  /** Aktywa w PLN według klasy aktywów (tylko konta wliczane). */
  readonly byClass: Readonly<Record<string, Dec>>;
  /** Wartość konta ze znakiem: aktywa > 0, zobowiązania < 0 (tylko konta wliczane). */
  readonly byAccount: Readonly<Record<string, Dec>>;
  /** Liczba pozycji z problemem wyceny (nieaktualna, brak ceny lub kursu) — `PortfolioSnapshot.staleCount`. */
  readonly staleCount: number;
}

function isCountedIssue(issue: ValuationIssue): boolean {
  return issue.type === "stale" || issue.type === "missingPrice" || issue.type === "missingFx";
}

export function valuePosition(
  position: PositionInput,
  date: DateKey,
  fx: FxTable,
  ownershipShare: DecInput = 1,
): PositionValuation {
  const pv = positionValueAt(position, date);
  const issues: ValuationIssue[] = [];
  const fxResolved = fxRateOn(fx, pv.currency, date);

  if (pv.value === null) issues.push({ type: "missingPrice" });
  if (!fxResolved) issues.push({ type: "missingFx", currency: pv.currency });
  else if (fxResolved.date && pv.value !== null && !pv.value.isZero()) {
    const s = staleness("fx", fxResolved.date, date);
    if (s.stale) issues.push({ type: "stale", staleness: s });
  }
  if (pv.sourceDate) {
    const kind = position.kind === "market" ? "price" : position.kind === "manual" ? "manual" : "liability";
    const s = staleness(kind, pv.sourceDate, date);
    if (s.stale) issues.push({ type: "stale", staleness: s });
  }
  if (pv.bond?.rateMissing && pv.bond.status === "active") issues.push({ type: "bondRateMissing" });
  if (pv.deposit?.checkRate && pv.deposit.status === "active") issues.push({ type: "depositCheckRate" });

  const valuePlnFull = pv.value !== null && fxResolved ? pv.value.times(fxResolved.rate) : null;
  return {
    ...pv,
    id: position.id,
    assetClass: position.assetClass ?? position.kind,
    fxRate: fxResolved?.rate ?? null,
    fxDate: fxResolved?.date ?? null,
    valuePlnFull,
    valuePln: valuePlnFull?.times(ownershipShare) ?? null,
    issues,
  };
}

export function valueAccount(account: AccountInput, date: DateKey, fx: FxTable): AccountValuation {
  const share = D(account.ownershipShare ?? 1);
  if (share.lte(0) || share.gt(1))
    throw new RangeError(`Udział własności konta ${account.id} poza zakresem 0–1`);
  const positions = account.positions.map((p) => valuePosition(p, date, fx, share));
  return {
    id: account.id,
    kind: account.kind,
    included: account.includeInNetWorth ?? true,
    ownershipShare: share,
    valuePln: positions.reduce((acc, p) => (p.valuePln ? acc.plus(p.valuePln) : acc), ZERO),
    complete: positions.every((p) => p.valuePln !== null),
    positions,
  };
}

function addTo(map: Record<string, Dec>, key: string, value: Dec) {
  map[key] = (map[key] ?? ZERO).plus(value);
}

export function netWorthAt(accounts: readonly AccountInput[], date: DateKey, fx: FxTable): NetWorthResult {
  const valued = accounts.map((a) => valueAccount(a, date, fx));
  let assets = ZERO;
  let liabilities = ZERO;
  let staleCount = 0;
  const byCurrency: Record<string, Dec> = {};
  const byClass: Record<string, Dec> = {};
  const byAccount: Record<string, Dec> = {};

  for (const account of valued) {
    if (!account.included) continue;
    if (account.kind === "ASSET") {
      assets = assets.plus(account.valuePln);
      byAccount[account.id] = account.valuePln;
      for (const p of account.positions) {
        if (!p.valuePln) continue;
        addTo(byCurrency, p.currency, p.valuePln);
        addTo(byClass, p.assetClass, p.valuePln);
      }
    } else {
      liabilities = liabilities.plus(account.valuePln);
      byAccount[account.id] = account.valuePln.neg();
    }
    staleCount += account.positions.filter((p) => p.issues.some(isCountedIssue)).length;
  }

  return {
    date,
    assets,
    liabilities,
    netWorth: assets.minus(liabilities),
    accounts: valued,
    byCurrency,
    byClass,
    byAccount,
    staleCount,
  };
}

/** Wartość netto dzień po dniu (przeliczenie wstecz „od D”, SPEC 7.7). */
export function netWorthHistory(
  accounts: readonly AccountInput[],
  from: DateKey,
  to: DateKey,
  fx: FxTable,
): NetWorthResult[] {
  return eachDay(from, to).map((d) => netWorthAt(accounts, d, fx));
}
