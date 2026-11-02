import { D, type Dec, type DecInput } from "@/lib/money";
import { addMonths, type DateKey } from "./dates";
import { lastIndexOnOrBefore, lastOnOrBefore, sortedByDate } from "./series";

/**
 * Zmiany wartości netto na pulpicie (SPEC 7.9), z migawek `PortfolioSnapshot`:
 * - dzienna: NW(D) − NW(poprzedni dzień z migawką);
 * - miesięczna: NW(D) − NW(ten sam dzień miesiąc wcześniej; gdy takiego dnia nie ma w kalendarzu,
 *   np. 31.02 — ostatni dzień tamtego miesiąca);
 * - roczna: analogicznie rok wcześniej (29.02 → 28.02).
 * Gdy w dniu odniesienia nie ma migawki, bierzemy ostatnią wcześniejszą (wartość netto jest funkcją
 * schodkową); brak jakiejkolwiek → `null`.
 * Procent = zmiana ÷ |NW odniesienia|; przy NW odniesienia ≤ 0 procentu nie ma (`null`).
 */
export interface NetWorthPoint {
  readonly date: DateKey;
  readonly netWorth: DecInput;
}

export interface NetWorthChange {
  readonly referenceDate: DateKey;
  readonly referenceValue: Dec;
  readonly amount: Dec;
  readonly percent: Dec | null;
}

export interface NetWorthChanges {
  readonly date: DateKey;
  readonly value: Dec;
  readonly daily: NetWorthChange | null;
  readonly monthly: NetWorthChange | null;
  readonly yearly: NetWorthChange | null;
}

function change(current: Dec, ref: NetWorthPoint | undefined): NetWorthChange | null {
  if (!ref) return null;
  const referenceValue = D(ref.netWorth);
  const amount = current.minus(referenceValue);
  return {
    referenceDate: ref.date,
    referenceValue,
    amount,
    percent: referenceValue.gt(0) ? amount.div(referenceValue.abs()) : null,
  };
}

/** `null`, gdy nie ma migawki z datą ≤ D. */
export function netWorthChanges(snapshots: readonly NetWorthPoint[], date: DateKey): NetWorthChanges | null {
  const sorted = sortedByDate(snapshots);
  const i = lastIndexOnOrBefore(sorted, date);
  if (i < 0) return null;
  const current = sorted[i];
  const value = D(current.netWorth);
  // addMonths przycina dzień do końca miesiąca, czyli realizuje regułę „ostatni dzień tamtego miesiąca”.
  return {
    date: current.date,
    value,
    daily: change(value, i > 0 ? sorted[i - 1] : undefined),
    monthly: change(value, lastOnOrBefore(sorted, addMonths(current.date, -1))),
    yearly: change(value, lastOnOrBefore(sorted, addMonths(current.date, -12))),
  };
}
