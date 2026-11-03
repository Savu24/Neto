"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getT } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { scopedDb } from "@/lib/db/scoped";
import { D } from "@/lib/money";
import { GoalInputError, parseGoalInput } from "@/lib/portfolio/goal-input";
import { createGoal, deleteGoal, GoalNotFoundError, updateGoal } from "@/lib/portfolio/goal-service";
import { parseUserNumber } from "@/lib/portfolio/import/numbers";
import { todayKey } from "@/lib/portfolio/valuation";

/** Akcje ekranu Cele (HU-5.1, 5.2). Każda woła requireUser() i pisze wyłącznie przez scopedDb. */

export type GoalActionState =
  { error?: string; message?: string; field?: string; values?: Record<string, string> } | undefined;

async function scoped() {
  const { user } = await requireUser();
  return { db: scopedDb(db(), user.id), userId: user.id };
}

function fields(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string" && k !== "accountIds") out[k] = v;
  return out;
}

const accountIds = (fd: FormData) =>
  fd.getAll("accountIds").filter((v): v is string => typeof v === "string");

async function errorState(e: unknown, values?: Record<string, string>): Promise<GoalActionState> {
  const t = await getT("goals");
  if (e instanceof GoalInputError) return { error: t(`err_${e.code}`), field: e.field, values };
  if (e instanceof GoalNotFoundError) return { error: t("err_notFound"), values };
  console.error(e);
  return { error: t("err_generic"), values };
}

function refresh() {
  revalidatePath("/goals");
  revalidatePath("/dashboard");
}

export async function createGoalAction(_: GoalActionState, fd: FormData): Promise<GoalActionState> {
  const { db: sdb, userId } = await scoped();
  const f = fields(fd);
  try {
    await createGoal(sdb, userId, parseGoalInput(f, accountIds(fd), todayKey()));
  } catch (e) {
    return errorState(e, f);
  }
  refresh();
  redirect("/goals");
}

export async function updateGoalAction(
  goalId: string,
  _: GoalActionState,
  fd: FormData,
): Promise<GoalActionState> {
  const { db: sdb } = await scoped();
  const f = fields(fd);
  try {
    await updateGoal(sdb, goalId, parseGoalInput(f, accountIds(fd), todayKey()));
  } catch (e) {
    return errorState(e, f);
  }
  refresh();
  redirect("/goals");
}

export async function deleteGoalAction(goalId: string): Promise<void> {
  const { db: sdb } = await scoped();
  await deleteGoal(sdb, goalId).catch((e: unknown) => {
    if (!(e instanceof GoalNotFoundError)) throw e;
  });
  refresh();
  redirect("/goals");
}

/** Szybkie „odłożyłem” dla celu wpisywanego ręcznie: dodaje kwotę (może być ujemna, suma nie spada poniżej 0). */
export async function addSavedAction(
  goalId: string,
  _: GoalActionState,
  fd: FormData,
): Promise<GoalActionState> {
  const { db: sdb } = await scoped();
  const t = await getT("goals");
  const raw = String(fd.get("amount") ?? "");
  const amount = raw.trim() ? parseUserNumber(raw) : null;
  if (amount === null || D(amount).isZero()) return { error: t("err_amount"), field: "amount" };
  const goal = await sdb.goal.findUnique({
    where: { id: goalId },
    select: { kind: true, savedAmount: true, _count: { select: { accounts: true } } },
  });
  if (!goal || goal.kind !== "SAVINGS" || goal._count.accounts > 0) return { error: t("err_notFound") };
  const next = D(goal.savedAmount?.toString() ?? 0).plus(D(amount));
  await sdb.goal.update({
    where: { id: goalId },
    data: { savedAmount: (next.isNeg() ? D(0) : next).toFixed(4) },
  });
  refresh();
  return { message: t("savedAdded") };
}
