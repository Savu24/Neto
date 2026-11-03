import type { AccountType, Capitalization, TaxWrapper } from "@/generated/prisma/enums";
import { D } from "@/lib/money";
import { parseUserNumber } from "@/lib/portfolio/import/numbers";
import { isDateKey, type DateKey } from "@/lib/portfolio/valuation/dates";
import { ACCOUNT_TYPES, valuationOf } from "./types";

/**
 * Walidacja formularza konta (HU-2.1, 2.5–2.7) bez bazy. Kody błędów = klucze `err_<kod>` w słowniku `assets`.
 * Procenty w formularzu (5,1), w bazie ułamki (0.051).
 */

export const TAX_WRAPPERS: readonly TaxWrapper[] = ["NONE", "IKE", "IKZE", "PPK", "OIPE"];
export const CAPITALIZATIONS: readonly Capitalization[] = ["END", "MONTHLY", "QUARTERLY", "ANNUAL"];

export type AccountErrorCode =
  | "name"
  | "type"
  | "currency"
  | "share"
  | "notes"
  | "balance"
  | "value"
  | "date"
  | "dateFuture"
  | "principal"
  | "rate"
  | "term"
  | "capitalization"
  | "interestRate"
  | "monthlyPayment"
  | "originalAmount"
  | "endDate";

export class AccountInputError extends Error {
  constructor(
    readonly code: AccountErrorCode,
    readonly field: string,
  ) {
    super(`${field}: ${code}`);
    this.name = "AccountInputError";
  }
}

export interface DepositDetails {
  readonly principal: string;
  readonly rate: string;
  readonly startDate: DateKey;
  readonly termMonths: number;
  readonly capitalization: Capitalization;
  readonly autoRenew: boolean;
  readonly payoutAccountId: string | null;
}

export interface LiabilityDetails {
  readonly interestRate: string | null;
  readonly monthlyPayment: string | null;
  readonly endDate: DateKey | null;
  readonly originalAmount: string | null;
}

export interface AccountInput {
  readonly name: string;
  readonly type: AccountType;
  readonly currency: string;
  readonly institution: string | null;
  readonly taxWrapper: TaxWrapper;
  /** Ułamek 0–1 jako napis (Decimal(5,4)). */
  readonly ownershipShare: string;
  readonly includeInNetWorth: boolean;
  readonly notes: string | null;
  /** Saldo, wycena albo saldo zobowiązania na start (transakcja BALANCE_SET / VALUATION). */
  readonly opening: { readonly amount: string; readonly date: DateKey } | null;
  readonly deposit: DepositDetails | null;
  readonly liability: LiabilityDetails | null;
}

type Fields = Record<string, string | undefined>;

const str = (f: Fields, k: string) => f[k]?.trim() ?? "";

function number(f: Fields, k: string, code: AccountErrorCode, opts: { min?: number; required?: boolean }) {
  const s = str(f, k);
  if (!s) {
    if (opts.required) throw new AccountInputError(code, k);
    return null;
  }
  const v = parseUserNumber(s);
  if (v === null || (opts.min !== undefined && D(v).lt(opts.min))) throw new AccountInputError(code, k);
  return v;
}

function percent(f: Fields, k: string, code: AccountErrorCode, required: boolean): string | null {
  const v = number(f, k, code, { min: 0, required });
  if (v === null) return null;
  if (D(v).gt(100)) throw new AccountInputError(code, k);
  return D(v).div(100).toFixed();
}

function date(f: Fields, k: string, today: DateKey, opts: { future?: boolean; required?: boolean }) {
  const s = str(f, k);
  if (!s) {
    if (opts.required) throw new AccountInputError("date", k);
    return null;
  }
  if (!isDateKey(s)) throw new AccountInputError(k === "endDate" ? "endDate" : "date", k);
  if (!opts.future && s > today) throw new AccountInputError("dateFuture", k);
  return s;
}

/**
 * `mode: "create"` czyta też wartości startowe (saldo, wycena), `"edit"` tylko dane konta i szczegóły
 * lokaty/kredytu (typ konta się nie zmienia; historię zmienia się transakcjami).
 */
export function parseAccountInput(
  f: Fields,
  today: DateKey,
  mode: "create" | "edit",
  fixedType?: AccountType,
): AccountInput {
  const name = str(f, "name");
  if (!name || name.length > 80) throw new AccountInputError("name", "name");
  const type = (fixedType ?? str(f, "type")) as AccountType;
  if (!(type in ACCOUNT_TYPES)) throw new AccountInputError("type", "type");
  const currency = (str(f, "currency") || "PLN").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new AccountInputError("currency", "currency");
  const institution = str(f, "institution").slice(0, 80) || null;
  const wrapper = (str(f, "taxWrapper") || "NONE") as TaxWrapper;
  const taxWrapper = TAX_WRAPPERS.includes(wrapper) ? wrapper : "NONE";
  const shareRaw = str(f, "ownershipShare");
  const sharePct = shareRaw ? parseUserNumber(shareRaw) : "100";
  if (sharePct === null || D(sharePct).lt(1) || D(sharePct).gt(100))
    throw new AccountInputError("share", "ownershipShare");
  const ownershipShare = D(sharePct).div(100).toDecimalPlaces(4).toFixed();
  // Niezaznaczone pole wyboru nie trafia do formularza; `includeInNetWorthShown` mówi, że pole było na ekranie.
  const includeInNetWorth = f.includeInNetWorthShown === "1" ? f.includeInNetWorth === "on" : true;
  const notes = str(f, "notes") || null;
  if (notes && notes.length > 2000) throw new AccountInputError("notes", "notes");

  const valuation = valuationOf(type);
  let opening: AccountInput["opening"] = null;
  let deposit: DepositDetails | null = null;
  let liability: LiabilityDetails | null = null;

  if (mode === "create" && (valuation === "cash" || valuation === "manual" || valuation === "liability")) {
    const code = valuation === "manual" ? "value" : "balance";
    const amount = number(f, "openingAmount", code, {
      min: valuation === "cash" ? undefined : 0,
      required: valuation !== "cash",
    });
    if (amount !== null) {
      opening = { amount, date: date(f, "openingDate", today, { required: false }) ?? today };
    }
  }

  if (valuation === "deposit") {
    const principal = number(f, "principal", "principal", { min: 0, required: true })!;
    if (D(principal).isZero()) throw new AccountInputError("principal", "principal");
    const rate = percent(f, "rate", "rate", true)!;
    const startDate = date(f, "startDate", today, { required: true })!;
    const term = Number(str(f, "termMonths"));
    if (!Number.isInteger(term) || term < 1 || term > 600) throw new AccountInputError("term", "termMonths");
    const cap = str(f, "capitalization") as Capitalization;
    if (!CAPITALIZATIONS.includes(cap)) throw new AccountInputError("capitalization", "capitalization");
    deposit = {
      principal,
      rate,
      startDate,
      termMonths: term,
      capitalization: cap,
      autoRenew: f.autoRenew === "on",
      payoutAccountId: str(f, "payoutAccountId") || null,
    };
  }

  if (valuation === "liability") {
    liability = {
      interestRate: percent(f, "interestRate", "interestRate", false),
      monthlyPayment: number(f, "monthlyPayment", "monthlyPayment", { min: 0 }),
      endDate: date(f, "endDate", today, { future: true }),
      originalAmount: number(f, "originalAmount", "originalAmount", { min: 0 }),
    };
  }

  return {
    name,
    type,
    currency,
    institution,
    taxWrapper,
    ownershipShare,
    includeInNetWorth,
    notes,
    opening,
    deposit,
    liability,
  };
}
