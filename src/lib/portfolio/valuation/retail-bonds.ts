import { D, sum, ZERO, type Dec, type DecInput } from "@/lib/money";
import { addMonths, daysBetween, minDate, type DateKey } from "./dates";

/**
 * Detaliczne obligacje skarbowe (SPEC 7.5), nominał 100 zł. Okresy odsetkowe liczone od daty zakupu
 * (zakup + i × długość okresu w miesiącach), dni w okresie = rzeczywista liczba dni tego okresu.
 *
 * - kapitalizujące (TOS, EDO, ROS, ROD), okres roczny:
 *     100 × Π(1 + r_i) za pełne lata × (1 + r_bieżące × dni / dni_w_roku_obligacji) × liczba sztuk
 * - OTS (3 miesiące, odsetki przy wykupie): 100 × (1 + r × dni / 365) × liczba sztuk
 * - kuponowe (ROR, DOR — kupon miesięczny; COI — roczny):
 *     100 × liczba sztuk + kupon narosły w bieżącym okresie;
 *     kupon okresu = 100 × r_i × (miesiące okresu / 12), narasta liniowo w dniach okresu.
 *     Wypłacone kupony (koniec okresu ≤ D) zwracamy w `coupons`, żeby zapisać je jako transakcje „odsetki”.
 * Bez opłaty za przedterminowy wykup i bez podatku („wartość przy trzymaniu do końca okresu, przed podatkiem”).
 * Bez zaokrągleń pośrednich do groszy (SPEC nie przewiduje); emitent zaokrągla wartość jednej obligacji,
 * co daje różnice rzędu grosza — do porównania z kalkulatorem obligacjeskarbowe.pl.
 *
 * Po terminie wartość stoi na kwocie wykupu, aż transakcja wykupu przeniesie środki (`redeemedAt`).
 * `redeemedAt` przed terminem to wykup przedterminowy: od tego dnia wartość 0 i nie ma dalszych kuponów.
 */
export type RetailBondType = "OTS" | "ROR" | "DOR" | "TOS" | "COI" | "EDO" | "ROS" | "ROD";

type Payout = "atMaturity" | "capitalized" | "coupon";

export const RETAIL_BOND_TERMS: Readonly<
  Record<RetailBondType, { months: number; periodMonths: number; payout: Payout; fixedRate: boolean }>
> = {
  OTS: { months: 3, periodMonths: 3, payout: "atMaturity", fixedRate: true },
  ROR: { months: 12, periodMonths: 1, payout: "coupon", fixedRate: false },
  DOR: { months: 24, periodMonths: 1, payout: "coupon", fixedRate: false },
  TOS: { months: 36, periodMonths: 12, payout: "capitalized", fixedRate: true },
  COI: { months: 48, periodMonths: 12, payout: "coupon", fixedRate: false },
  EDO: { months: 120, periodMonths: 12, payout: "capitalized", fixedRate: false },
  ROS: { months: 72, periodMonths: 12, payout: "capitalized", fixedRate: false },
  ROD: { months: 144, periodMonths: 12, payout: "capitalized", fixedRate: false },
};

export const RETAIL_BOND_NOMINAL = D(100);

export interface RetailBondInput {
  readonly type: RetailBondType;
  readonly count: DecInput;
  readonly purchaseDate: DateKey;
  /**
   * Oprocentowanie okresów jako ułamki, indeks = numer okresu od 0 (pierwszy okres to stopa z listu emisyjnego).
   * Okres = rok dla TOS/COI/EDO/ROS/ROD, miesiąc dla ROR/DOR, cała obligacja dla OTS.
   * Brak stopy dla bieżącego okresu → przyjmujemy ostatnią znaną i ustawiamy `rateMissing`.
   * OTS i TOS mają stałe oprocentowanie: wystarczy jedna stopa, obowiązuje we wszystkich okresach.
   */
  readonly periodRates: readonly DecInput[];
  /** Dzień wypłaty środków z wykupu (od tego dnia wartość 0). */
  readonly redeemedAt?: DateKey;
}

export type RetailBondStatus = "notStarted" | "active" | "matured" | "redeemed";

export interface CouponPayment {
  readonly date: DateKey;
  readonly periodIndex: number;
  /** Kwota dla wszystkich sztuk. */
  readonly amount: Dec;
}

export interface RetailBondValuation {
  /** Wartość wszystkich sztuk. */
  readonly value: Dec;
  /** Wartość jednej obligacji. */
  readonly perBond: Dec;
  readonly status: RetailBondStatus;
  readonly maturityDate: DateKey;
  /** Bieżący okres odsetkowy (po wykupie: ostatni). */
  readonly periodIndex: number;
  readonly periodStart: DateKey;
  readonly periodEnd: DateKey;
  /** Odsetki narosłe w bieżącym okresie (wszystkie sztuki). */
  readonly accrued: Dec;
  /** Wypłacone kupony do dnia D włącznie (typy kuponowe). */
  readonly coupons: readonly CouponPayment[];
  readonly rateMissing: boolean;
}

export function retailBondMaturityDate(bond: Pick<RetailBondInput, "type" | "purchaseDate">): DateKey {
  return addMonths(bond.purchaseDate, RETAIL_BOND_TERMS[bond.type].months);
}

/** Seria w formacie TYPMMRR (np. EDO1126 = EDO z wykupem w listopadzie 2026). */
export function parseRetailBondSeries(code: string): { type: RetailBondType; maturityMonth: string } | null {
  const m = /^(OTS|ROR|DOR|TOS|COI|EDO|ROS|ROD)(\d{2})(\d{2})$/.exec(code.trim().toUpperCase());
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return null;
  return { type: m[1] as RetailBondType, maturityMonth: `20${m[3]}-${m[2]}` };
}

export function retailBondValueAt(bond: RetailBondInput, date: DateKey): RetailBondValuation {
  if (bond.periodRates.length === 0)
    throw new RangeError("Obligacja wymaga oprocentowania pierwszego okresu");
  const terms = RETAIL_BOND_TERMS[bond.type];
  const count = D(bond.count);
  const periods = terms.months / terms.periodMonths;
  const maturity = retailBondMaturityDate(bond);
  const periodStartOf = (i: number) => addMonths(bond.purchaseDate, terms.periodMonths * i);
  let rateMissing = false;
  const rateOf = (i: number): Dec => {
    if (terms.fixedRate) return D(bond.periodRates[0]);
    if (i < bond.periodRates.length) return D(bond.periodRates[i]);
    rateMissing = true;
    return D(bond.periodRates[bond.periodRates.length - 1]);
  };

  if (date < bond.purchaseDate) {
    return {
      value: ZERO,
      perBond: ZERO,
      status: "notStarted",
      maturityDate: maturity,
      periodIndex: 0,
      periodStart: bond.purchaseDate,
      periodEnd: periodStartOf(1),
      accrued: ZERO,
      coupons: [],
      rateMissing: false,
    };
  }

  const end = minDate(minDate(date, maturity), bond.redeemedAt ?? maturity);
  // Numer bieżącego okresu: ostatni, którego początek ≤ end (przy wykupie: ostatni okres, w pełni naliczony).
  let index = 0;
  while (index + 1 < periods && periodStartOf(index + 1) <= end) index++;
  const periodStart = periodStartOf(index);
  const periodEnd = periodStartOf(index + 1);
  const daysInPeriod = daysBetween(periodStart, periodEnd);
  const elapsed = daysBetween(periodStart, end);
  const rate = rateOf(index);

  let perBond: Dec;
  let accruedPerBond: Dec;
  const coupons: CouponPayment[] = [];

  if (terms.payout === "atMaturity") {
    accruedPerBond = RETAIL_BOND_NOMINAL.times(rate).times(elapsed).div(365);
    perBond = RETAIL_BOND_NOMINAL.plus(accruedPerBond);
  } else if (terms.payout === "capitalized") {
    let base = RETAIL_BOND_NOMINAL;
    for (let i = 0; i < index; i++) base = base.times(rateOf(i).plus(1));
    accruedPerBond = base.times(rate).times(elapsed).div(daysInPeriod);
    perBond = base.plus(accruedPerBond);
  } else {
    const couponPerBond = (i: number) =>
      RETAIL_BOND_NOMINAL.times(rateOf(i)).times(terms.periodMonths).div(12);
    for (let i = 0; i < periods; i++) {
      const paidOn = periodStartOf(i + 1);
      if (paidOn > end) break;
      coupons.push({ date: paidOn, periodIndex: i, amount: couponPerBond(i).times(count) });
    }
    // W dniu końca okresu kupon jest już wypłacony; narasta kupon okresu następnego (od zera).
    const atBoundary = elapsed === daysInPeriod;
    accruedPerBond = atBoundary ? ZERO : couponPerBond(index).times(elapsed).div(daysInPeriod);
    perBond = RETAIL_BOND_NOMINAL.plus(accruedPerBond);
  }

  const matured = date >= maturity;
  const redeemed = bond.redeemedAt !== undefined && date >= bond.redeemedAt;
  const value = redeemed ? ZERO : perBond.times(count);
  return {
    value,
    perBond: redeemed ? ZERO : perBond,
    status: redeemed ? "redeemed" : matured ? "matured" : "active",
    maturityDate: maturity,
    periodIndex: index,
    periodStart,
    periodEnd,
    accrued: redeemed ? ZERO : accruedPerBond.times(count),
    coupons,
    rateMissing,
  };
}

/** Suma wypłaconych kuponów do dnia D. */
export function retailBondCouponsTotal(valuation: RetailBondValuation): Dec {
  return sum(valuation.coupons.map((c) => c.amount));
}
