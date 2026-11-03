"use server";

import { revalidatePath } from "next/cache";
import { getT } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { scopedDb } from "@/lib/db/scoped";
import { D } from "@/lib/money";
import { todayKey } from "@/lib/portfolio/valuation";
import { normalizeNumber, parseAssumptions, type AssumptionValues } from "./assumptions";

/** Zapis założeń kalkulatora (`RetirementPlan`) i roku urodzenia z wieku. Majątek startowy liczymy z kont. */
export async function saveRetirementPlanAction(
  values: AssumptionValues,
): Promise<{ ok: boolean; message: string }> {
  const { user } = await requireUser();
  const t = await getT("retirement");
  const parsed = parseAssumptions(values);
  if (parsed.status !== "ok") return { ok: false, message: t("fixErrors") };
  const frac = (v: string) => D(normalizeNumber(v)).div(100).toFixed(6);
  const money = (v: string) => (v.trim() ? D(normalizeNumber(v)).toFixed(4) : "0");
  const data = {
    retireAge: Number(normalizeNumber(values.retireAge)),
    monthlyContribution: money(values.monthlyContribution),
    monthlySpending: money(values.monthlySpending),
    zusMonthly: money(values.zusMonthly),
    withdrawalRate: frac(values.withdrawalRate),
    returnLow: frac(values.returnLow),
    returnBase: frac(values.returnBase),
    returnHigh: frac(values.returnHigh),
    inflation: frac(values.inflation),
  };
  const sdb = scopedDb(db(), user.id);
  await sdb.retirementPlan.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  });
  const age = Number(normalizeNumber(values.currentAge));
  await sdb.user.update({
    where: { id: user.id },
    data: { birthYear: Number(todayKey().slice(0, 4)) - age },
  });
  revalidatePath("/goals/retirement");
  return { ok: true, message: t("saved") };
}
