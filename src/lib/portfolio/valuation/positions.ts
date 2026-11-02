import { D, ZERO, type Dec, type DecInput } from "@/lib/money";
import type { DateKey } from "./dates";
import { depositValueAt, type DepositInput, type DepositValuation } from "./deposit";
import { quantityOn, type TradeInput } from "./fifo";
import { retailBondValueAt, type RetailBondInput, type RetailBondValuation } from "./retail-bonds";
import { lastIndexOnOrBefore, lastOnOrBefore, memoByArray, sortedByDate } from "./series";

/**
 * Wartość pozycji na dzień D w jej walucie (SPEC 7.3). Wejście to zwykłe obiekty: warstwa bazy
 * (Etap 6) mapuje na nie Transaction, PriceSnapshot, Deposit, RetailBondSeries itd.
 */

export interface DatedAmount {
  readonly date: DateKey;
  readonly amount: DecInput;
}

export interface PricePoint {
  readonly date: DateKey;
  /** Cena zamknięcia w walucie instrumentu. */
  readonly close: DecInput;
}

/**
 * Przepływ gotówkowy rachunku: wpłata/odsetki > 0, wypłata/opłata/podatek < 0, rozliczenie kupna < 0,
 * sprzedaży > 0. `set: true` to korekta salda (BALANCE_SET): saldo po tej operacji = `amount`.
 * Operacje z tego samego dnia stosujemy w kolejności wejścia.
 */
export interface CashFlowInput extends DatedAmount {
  readonly set?: boolean;
}

interface PositionBase {
  /** Identyfikator do raportów (np. Holding.id albo accountId). */
  readonly id?: string;
  /** Klasa aktywów do alokacji (np. "ETF", "CASH"); domyślnie rodzaj pozycji. */
  readonly assetClass?: string;
}

export type PositionInput =
  | (PositionBase & {
      readonly kind: "cash";
      readonly currency: string;
      readonly flows: readonly CashFlowInput[];
    })
  | (PositionBase & {
      readonly kind: "market";
      readonly currency: string;
      readonly trades: readonly TradeInput[];
      readonly prices: readonly PricePoint[];
    })
  | (PositionBase & { readonly kind: "deposit"; readonly currency: string; readonly deposit: DepositInput })
  | (PositionBase & { readonly kind: "retailBond"; readonly bond: RetailBondInput })
  | (PositionBase & {
      readonly kind: "manual";
      readonly currency: string;
      readonly valuations: readonly DatedAmount[];
    })
  | (PositionBase & {
      readonly kind: "liability";
      readonly currency: string;
      readonly balances: readonly DatedAmount[];
    });

export type PositionKind = PositionInput["kind"];

export interface PositionValue {
  readonly kind: PositionKind;
  readonly currency: string;
  /** `null`, gdy wartości nie da się ustalić (np. brak jakiejkolwiek ceny przy dodatniej ilości). */
  readonly value: Dec | null;
  /** Data danych źródłowych (cena, wycena, saldo) do oceny nieaktualności; `null`, gdy nie dotyczy. */
  readonly sourceDate: DateKey | null;
  readonly quantity?: Dec;
  readonly price?: Dec;
  /** Brak notowania ≤ D: użyto ceny z ostatniej transakcji (SPEC 7.7: oznaczenie). */
  readonly priceFromTrade?: boolean;
  readonly deposit?: DepositValuation;
  readonly bond?: RetailBondValuation;
}

export function positionCurrency(position: PositionInput): string {
  return position.kind === "retailBond" ? "PLN" : position.currency;
}

const cumulativeCash = memoByArray((flows: readonly CashFlowInput[]) => {
  let balance = ZERO;
  return sortedByDate(flows).map((f) => {
    balance = f.set ? D(f.amount) : balance.plus(f.amount);
    return { date: f.date, balance };
  });
});

export function cashBalanceOn(flows: readonly CashFlowInput[], date: DateKey): Dec {
  const cumulative = cumulativeCash(flows);
  const i = lastIndexOnOrBefore(cumulative, date);
  return i < 0 ? ZERO : cumulative[i].balance;
}

function marketValue(
  position: Extract<PositionInput, { kind: "market" }>,
  date: DateKey,
): Omit<PositionValue, "kind" | "currency"> {
  const quantity = quantityOn(position.trades, date);
  if (quantity.isZero()) return { value: ZERO, sourceDate: null, quantity };
  const quote = lastOnOrBefore(position.prices, date);
  if (quote) {
    const price = D(quote.close);
    return { value: quantity.times(price), sourceDate: quote.date, quantity, price };
  }
  const trade = lastOnOrBefore(position.trades, date);
  if (!trade) return { value: null, sourceDate: null, quantity };
  const price = D(trade.price);
  return { value: quantity.times(price), sourceDate: trade.date, quantity, price, priceFromTrade: true };
}

export function positionValueAt(position: PositionInput, date: DateKey): PositionValue {
  const currency = positionCurrency(position);
  const kind = position.kind;
  switch (position.kind) {
    case "cash":
      return { kind, currency, value: cashBalanceOn(position.flows, date), sourceDate: null };
    case "market":
      return { kind, currency, ...marketValue(position, date) };
    case "deposit": {
      const deposit = depositValueAt(position.deposit, date);
      return { kind, currency, value: deposit.value, sourceDate: null, deposit };
    }
    case "retailBond": {
      const bond = retailBondValueAt(position.bond, date);
      return { kind, currency, value: bond.value, sourceDate: null, bond };
    }
    case "manual":
    case "liability": {
      const points = position.kind === "manual" ? position.valuations : position.balances;
      const last = lastOnOrBefore(points, date);
      // Przed pierwszą wyceną/saldem aktywa jeszcze nie ma: wartość 0, nie brak danych.
      return { kind, currency, value: last ? D(last.amount) : ZERO, sourceDate: last?.date ?? null };
    }
  }
}
