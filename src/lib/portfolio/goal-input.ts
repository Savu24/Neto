import { D } from "@/lib/money";
import { parseUserNumber } from "@/lib/portfolio/import/numbers";
import { isDateKey, type DateKey } from "@/lib/portfolio/valuation/dates";

/**
 * Walidacja formularza celu (HU-5.1, 5.2) bez bazy. Kody błędów = klucze `err_<kod>` w słowniku `goals`.
 * Źródło bieżącej wartości: kwota wpisana ręcznie („od zera”), wybrane konta albo cała wartość netto.
 */

export const GOAL_SOURCES = ["manual", "accounts", "netWorth"] as const;
export type GoalSource = (typeof GOAL_SOURCES)[number];

export type GoalErrorCode = "name" | "target" | "date" | "datePast" | "saved" | "accounts";

export class GoalInputError extends Error {
  constructor(
    readonly code: GoalErrorCode,
    readonly field: string,
  ) {
    super(`${field}: ${code}`);
    this.name = "GoalInputError";
  }
}

export interface GoalInput {
  readonly name: string;
  readonly targetAmount: string;
  readonly targetDate: DateKey | null;
  readonly source: GoalSource;
  /** Tylko dla źródła „manual”; null = 0. */
  readonly savedAmount: string | null;
  /** Tylko dla źródła „accounts”. */
  readonly accountIds: readonly string[];
  readonly isMain: boolean;
}

const MAX_AMOUNT = D("1e15");

/** `fields`: pola tekstowe formularza; `accountIds`: wszystkie zaznaczone konta (pole wielokrotne). */
export function parseGoalInput(
  fields: Record<string, string | undefined>,
  accountIds: readonly string[],
  today: DateKey,
): GoalInput {
  const name = fields.name?.trim() ?? "";
  if (!name || name.length > 80) throw new GoalInputError("name", "name");

  const target = parseUserNumber(fields.targetAmount ?? "");
  if (target === null || D(target).lte(0) || D(target).gt(MAX_AMOUNT))
    throw new GoalInputError("target", "targetAmount");

  const rawDate = fields.targetDate?.trim() ?? "";
  let targetDate: DateKey | null = null;
  if (rawDate) {
    if (!isDateKey(rawDate)) throw new GoalInputError("date", "targetDate");
    if (rawDate <= today) throw new GoalInputError("datePast", "targetDate");
    targetDate = rawDate;
  }

  const source = (GOAL_SOURCES as readonly string[]).includes(fields.source ?? "")
    ? (fields.source as GoalSource)
    : "manual";

  let savedAmount: string | null = null;
  if (source === "manual" && fields.savedAmount?.trim()) {
    const saved = parseUserNumber(fields.savedAmount);
    if (saved === null || D(saved).lt(0) || D(saved).gt(MAX_AMOUNT))
      throw new GoalInputError("saved", "savedAmount");
    savedAmount = D(saved).toFixed();
  }

  const ids = source === "accounts" ? [...new Set(accountIds.filter(Boolean))] : [];
  if (source === "accounts" && ids.length === 0) throw new GoalInputError("accounts", "accountIds");

  return {
    name,
    targetAmount: D(target).toFixed(),
    targetDate,
    source,
    savedAmount,
    accountIds: ids,
    isMain: fields.isMain === "on" || fields.isMain === "1",
  };
}
