import type { TransactionType } from "@/generated/prisma/enums";
import { D } from "@/lib/money";
import { parseUserNumber } from "@/lib/portfolio/import/numbers";
import { isDateKey, type DateKey } from "@/lib/portfolio/valuation/dates";
import { amountSign, isTrade } from "./types";

/**
 * Walidacja formularza transakcji (HU-2.3) bez bazy: liczby po polsku i po angielsku, data nie z przyszłości,
 * wymagane pola dla rodzaju. Kody błędów odpowiadają kluczom `err_<kod>` w słowniku `transactions`.
 */

export const TRANSACTION_TYPES: readonly TransactionType[] = [
  "BUY",
  "SELL",
  "DEPOSIT",
  "WITHDRAWAL",
  "DIVIDEND",
  "INTEREST",
  "FEE",
  "TAX",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "VALUATION",
  "BALANCE_SET",
];

export type InputErrorCode =
  | "account"
  | "type"
  | "date"
  | "dateFuture"
  | "amount"
  | "quantity"
  | "price"
  | "fee"
  | "fxRate"
  | "asset"
  | "currency"
  | "transferTarget"
  | "transferSame"
  | "transferAmount";

export class InputError extends Error {
  constructor(
    readonly code: InputErrorCode,
    readonly field: string,
  ) {
    super(`${field}: ${code}`);
    this.name = "InputError";
  }
}

export interface TransactionInput {
  readonly accountId: string;
  readonly type: TransactionType;
  readonly date: DateKey;
  /** Kwota ze znakiem skutku dla gotówki (`Transaction.amount`); dla kupna/sprzedaży liczona z ilości i ceny. */
  readonly amount: string;
  readonly quantity: string | null;
  readonly price: string | null;
  readonly fee: string | null;
  readonly fxRate: string | null;
  readonly assetId: string | null;
  /** `null` → waluta konta (gotówka) albo instrumentu (kupno/sprzedaż). */
  readonly currency: string | null;
  readonly note: string | null;
  /** Przelew: konto docelowe i kwota po stronie docelowej (gdy waluty kont się różnią). */
  readonly toAccountId: string | null;
  readonly toAmount: string | null;
}

type Fields = Record<string, string | undefined>;

function positive(
  raw: string | undefined,
  code: InputErrorCode,
  field: string,
  required = true,
): string | null {
  const s = raw?.trim() ?? "";
  if (!s) {
    if (required) throw new InputError(code, field);
    return null;
  }
  const v = parseUserNumber(s);
  if (v === null || D(v).lte(0)) throw new InputError(code, field);
  return v;
}

function nonNegative(raw: string | undefined, code: InputErrorCode, field: string): string | null {
  const s = raw?.trim() ?? "";
  if (!s) return null;
  const v = parseUserNumber(s);
  if (v === null || D(v).isNeg()) throw new InputError(code, field);
  return D(v).isZero() ? null : v;
}

export function parseDateField(raw: string | undefined, today: DateKey, field = "date"): DateKey {
  const s = raw?.trim() ?? "";
  if (!isDateKey(s)) throw new InputError("date", field);
  if (s > today) throw new InputError("dateFuture", field);
  return s;
}

/** Pola formularza → transakcja. Rzuca `InputError` z polem, którego dotyczy błąd. */
export function parseTransactionInput(f: Fields, today: DateKey): TransactionInput {
  const accountId = f.accountId?.trim();
  if (!accountId) throw new InputError("account", "accountId");
  const type = f.type as TransactionType;
  if (!TRANSACTION_TYPES.includes(type) || type === "TRANSFER_IN") throw new InputError("type", "type");
  const date = parseDateField(f.date, today);
  const note = f.note?.trim().slice(0, 500) || null;
  const currencyRaw = f.currency?.trim().toUpperCase() || null;
  if (currencyRaw && !/^[A-Z]{3}$/.test(currencyRaw)) throw new InputError("currency", "currency");
  const base = {
    accountId,
    type,
    date,
    note,
    currency: currencyRaw,
    quantity: null,
    price: null,
    fee: null,
    fxRate: null,
    assetId: null,
    toAccountId: null,
    toAmount: null,
  };

  if (isTrade(type)) {
    const assetId = f.assetId?.trim();
    if (!assetId) throw new InputError("asset", "assetId");
    const quantity = positive(f.quantity, "quantity", "quantity")!;
    const price = positive(f.price, "price", "price")!;
    const fee = nonNegative(f.fee, "fee", "fee");
    const fxRate = positive(f.fxRate, "fxRate", "fxRate", false);
    const value = D(quantity).times(price);
    const settled = type === "BUY" ? value.plus(fee ?? 0) : value.minus(fee ?? 0);
    if (settled.lte(0)) throw new InputError("fee", "fee");
    return {
      ...base,
      assetId,
      quantity,
      price,
      fee,
      fxRate,
      amount: settled.times(amountSign(type)).toFixed(),
    };
  }

  if (type === "BALANCE_SET") {
    // Saldo konta gotówkowego może być ujemne (debet); saldo zobowiązania sprawdza serwis.
    const s = f.amount?.trim() ?? "";
    const v = s ? parseUserNumber(s) : null;
    if (v === null) throw new InputError("amount", "amount");
    return { ...base, amount: v };
  }

  if (type === "VALUATION") {
    // Wycena może spaść do zera (np. zezłomowany samochód).
    const amount = nonNegative(f.amount, "amount", "amount") ?? (f.amount?.trim() ? "0" : null);
    if (amount === null) throw new InputError("amount", "amount");
    return { ...base, amount };
  }
  const amount = positive(f.amount, "amount", "amount")!;

  if (type === "TRANSFER_OUT") {
    const toAccountId = f.toAccountId?.trim() || null;
    if (!toAccountId) throw new InputError("transferTarget", "toAccountId");
    if (toAccountId === accountId) throw new InputError("transferSame", "toAccountId");
    const toAmount = positive(f.toAmount, "transferAmount", "toAmount", false);
    return { ...base, amount: D(amount).neg().toFixed(), toAccountId, toAmount };
  }

  const assetId = type === "DIVIDEND" ? f.assetId?.trim() || null : null;
  return { ...base, assetId, amount: D(amount).times(amountSign(type)).toFixed() };
}
