import type { AccountKind, AccountType, TransactionType } from "@/generated/prisma/enums";

/**
 * Typy kont (SPEC 8, HU-2.1) i reguły, które z nich wynikają: rodzaj (aktywo/zobowiązanie), grupa na ekranie
 * Majątek, sposób wyceny i dozwolone transakcje. Czyste dane: używane i w formularzach, i na serwerze.
 */

export type Valuation = "cash" | "investment" | "deposit" | "manual" | "liability";

/** Grupy na ekranie Majątek (makieta majatek.html). */
export type AccountGroup = "cash" | "investments" | "bondsCrypto" | "property" | "liabilities";

interface TypeInfo {
  readonly kind: AccountKind;
  readonly group: AccountGroup;
  readonly valuation: Valuation;
}

export const ACCOUNT_TYPES: Readonly<Record<AccountType, TypeInfo>> = {
  CASH: { kind: "ASSET", group: "cash", valuation: "cash" },
  CHECKING: { kind: "ASSET", group: "cash", valuation: "cash" },
  SAVINGS: { kind: "ASSET", group: "cash", valuation: "cash" },
  DEPOSIT: { kind: "ASSET", group: "cash", valuation: "deposit" },
  BROKERAGE: { kind: "ASSET", group: "investments", valuation: "investment" },
  RETIREMENT: { kind: "ASSET", group: "investments", valuation: "investment" },
  CRYPTO: { kind: "ASSET", group: "bondsCrypto", valuation: "investment" },
  RETAIL_BONDS: { kind: "ASSET", group: "bondsCrypto", valuation: "investment" },
  REAL_ESTATE: { kind: "ASSET", group: "property", valuation: "manual" },
  VEHICLE: { kind: "ASSET", group: "property", valuation: "manual" },
  OTHER_ASSET: { kind: "ASSET", group: "property", valuation: "manual" },
  MORTGAGE: { kind: "LIABILITY", group: "liabilities", valuation: "liability" },
  LOAN: { kind: "LIABILITY", group: "liabilities", valuation: "liability" },
  LEASE: { kind: "LIABILITY", group: "liabilities", valuation: "liability" },
  CREDIT_CARD: { kind: "LIABILITY", group: "liabilities", valuation: "liability" },
  OTHER_LIABILITY: { kind: "LIABILITY", group: "liabilities", valuation: "liability" },
};

export const ACCOUNT_TYPE_LIST = Object.keys(ACCOUNT_TYPES) as AccountType[];
export const ACCOUNT_GROUPS: readonly AccountGroup[] = [
  "cash",
  "investments",
  "bondsCrypto",
  "property",
  "liabilities",
];

export function accountKind(type: AccountType): AccountKind {
  return ACCOUNT_TYPES[type].kind;
}

export function valuationOf(type: AccountType): Valuation {
  return ACCOUNT_TYPES[type].valuation;
}

/** Konta, na których prowadzi się instrumenty (kupno/sprzedaż). */
export function holdsInstruments(type: AccountType): boolean {
  return valuationOf(type) === "investment";
}

const CASH_FLOW_TYPES: readonly TransactionType[] = [
  "DEPOSIT",
  "WITHDRAWAL",
  "INTEREST",
  "FEE",
  "TAX",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "BALANCE_SET",
];

/** Transakcje, które użytkownik może dodać na koncie danego typu (HU-2.3). */
export function allowedTransactions(type: AccountType): readonly TransactionType[] {
  switch (valuationOf(type)) {
    case "cash":
      return CASH_FLOW_TYPES;
    case "investment":
      return ["BUY", "SELL", "DIVIDEND", ...CASH_FLOW_TYPES];
    case "deposit":
      // Lokatę kończy przelew na konto wypłaty; odsetki liczy wzór z SPEC 7.4.
      return ["TRANSFER_OUT"];
    case "manual":
      return ["VALUATION"];
    case "liability":
      return ["BALANCE_SET"];
  }
}

/** Transakcje, które mogą być jedną stroną przelewu między kontami. */
export function acceptsTransfers(type: AccountType): boolean {
  const v = valuationOf(type);
  return v === "cash" || v === "investment";
}

/**
 * Znak kwoty w bazie (`Transaction.amount`): skutek dla gotówki na koncie, jak w seedzie (kupno < 0).
 * Wycena i korekta salda to wartość bezwzględna (nowa wartość/saldo), nie przepływ.
 */
export function amountSign(type: TransactionType): 1 | -1 | 0 {
  switch (type) {
    case "BUY":
    case "WITHDRAWAL":
    case "FEE":
    case "TAX":
    case "TRANSFER_OUT":
      return -1;
    case "SELL":
    case "DEPOSIT":
    case "DIVIDEND":
    case "INTEREST":
    case "TRANSFER_IN":
      return 1;
    case "VALUATION":
    case "BALANCE_SET":
      return 0;
  }
}

export const TRADE_TYPES: readonly TransactionType[] = ["BUY", "SELL"];

export function isTrade(type: TransactionType): type is "BUY" | "SELL" {
  return type === "BUY" || type === "SELL";
}
