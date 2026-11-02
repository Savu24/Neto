import { D } from "@/lib/money";
import { HORIZON_AGE, type RetirementInput } from "@/lib/portfolio/retirement";

/**
 * Założenia kalkulatora tak, jak je wpisuje użytkownik (napisy z pól formularza),
 * i ich zamiana na wejście `calculateRetirement`. Procenty wpisuje się jako „4”, nie „0,04”.
 */

export const fields = [
  "currentAge",
  "retireAge",
  "startingCapital",
  "monthlyContribution",
  "monthlySpending",
  "zusMonthly",
  "withdrawalRate",
  "returnLow",
  "returnBase",
  "returnHigh",
  "inflation",
] as const;
export type Field = (typeof fields)[number];
export type AssumptionValues = Record<Field, string>;

/** Wartości domyślne z SPEC 7.11. Wiek obecny i wydatki są puste, dopóki użytkownik ich nie wpisze. */
export const specDefaults: AssumptionValues = {
  currentAge: "",
  retireAge: "65",
  startingCapital: "0",
  monthlyContribution: "0",
  monthlySpending: "",
  zusMonthly: "0",
  withdrawalRate: "4",
  returnLow: "1",
  returnBase: "3",
  returnHigh: "5",
  inflation: "3",
};

export type FieldError =
  | { key: "errorNumber" }
  | { key: "errorInteger" }
  | { key: "errorMin"; params: { min: string } }
  | { key: "errorRange"; params: { min: string; max: string } };

export type ParsedAssumptions =
  | { status: "ok"; input: RetirementInput }
  | { status: "missingAge"; errors: Partial<Record<Field, FieldError>> }
  | { status: "invalid"; errors: Partial<Record<Field, FieldError>> };

const NUMBER = /^-?\d+(\.\d+)?$/;
const INTEGER = /^\d+$/;

/** „1 234,5” → „1234.5”: spacje (też twarde), przecinek dziesiętny i typograficzny minus. */
export function normalizeNumber(raw: string): string {
  return raw
    .replace(/[\s  ]/g, "")
    .replace(",", ".")
    .replace("−", "-");
}

const percentBounds = {
  withdrawalRate: [0.1, 20],
  returnLow: [-20, 20],
  returnBase: [-20, 20],
  returnHigh: [-20, 20],
  inflation: [-10, 30],
} as const;

export function parseAssumptions(values: AssumptionValues): ParsedAssumptions {
  const errors: Partial<Record<Field, FieldError>> = {};

  const age = (field: "currentAge" | "retireAge", min: number): number | null => {
    const v = normalizeNumber(values[field]);
    if (!INTEGER.test(v)) {
      errors[field] = NUMBER.test(v) ? { key: "errorInteger" } : { key: "errorNumber" };
      return null;
    }
    const n = Number(v);
    if (n < min || n > HORIZON_AGE) {
      errors[field] = { key: "errorRange", params: { min: String(min), max: String(HORIZON_AGE) } };
      return null;
    }
    return n;
  };

  const amount = (field: Field, emptyAs: string | null): string | null => {
    const v = normalizeNumber(values[field]);
    if (v === "") return emptyAs;
    if (!NUMBER.test(v)) {
      errors[field] = { key: "errorNumber" };
      return null;
    }
    if (D(v).isNeg()) {
      errors[field] = { key: "errorMin", params: { min: "0" } };
      return null;
    }
    return v;
  };

  const percent = (field: keyof typeof percentBounds): string | null => {
    const v = normalizeNumber(values[field]);
    if (!NUMBER.test(v)) {
      errors[field] = { key: "errorNumber" };
      return null;
    }
    const [min, max] = percentBounds[field];
    if (D(v).lt(min) || D(v).gt(max)) {
      errors[field] = { key: "errorRange", params: { min: String(min), max: String(max) } };
      return null;
    }
    return D(v).div(100).toString();
  };

  const ageMissing = normalizeNumber(values.currentAge) === "";
  const currentAge = ageMissing ? null : age("currentAge", 0);
  const retireAge = age("retireAge", currentAge ?? 0);
  const startingCapital = amount("startingCapital", "0");
  const monthlyContribution = amount("monthlyContribution", "0");
  const monthlySpending = amount("monthlySpending", null);
  const zusMonthly = amount("zusMonthly", "0");
  const withdrawalRate = percent("withdrawalRate");
  const returnLow = percent("returnLow");
  const returnBase = percent("returnBase");
  const returnHigh = percent("returnHigh");
  const inflation = percent("inflation");

  if (Object.keys(errors).length > 0) return { status: "invalid", errors };
  if (currentAge === null) return { status: "missingAge", errors };

  return {
    status: "ok",
    input: {
      currentAge,
      retireAge: retireAge!,
      startingCapital: startingCapital!,
      monthlyContribution: monthlyContribution!,
      monthlySpending,
      zusMonthly: zusMonthly!,
      withdrawalRate: withdrawalRate!,
      returns: { low: returnLow!, base: returnBase!, high: returnHigh! },
      inflation: inflation!,
    },
  };
}
