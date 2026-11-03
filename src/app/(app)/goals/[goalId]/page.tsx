import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page";
import { I18nProvider } from "@/i18n/client";
import { getLocale, getT, pickMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { scopedDb } from "@/lib/db/scoped";
import { loadGoals } from "@/lib/portfolio/goal-service";
import { todayKey } from "@/lib/portfolio/valuation";
import { BackLink } from "../../assets/ui";
import { deleteGoalAction, updateGoalAction } from "../actions";
import { goalFormData } from "../form-data";
import { DeleteGoalButton, GoalForm } from "../goal-form";

export const metadata: Metadata = { title: "Edytuj cel" };

export default async function EditGoalPage({ params }: PageProps<"/goals/[goalId]">) {
  const { user } = await requireUser();
  const { goalId } = await params;
  const [t, locale] = await Promise.all([getT("goals"), getLocale()]);
  const today = todayKey();
  const sdb = scopedDb(db(), user.id);
  const { portfolio, accounts, netWorth } = await goalFormData(sdb, today);
  const goal = (await loadGoals(sdb, portfolio, today)).find((g) => g.id === goalId);
  if (!goal) notFound();
  return (
    <>
      <BackLink href="/goals">{t("back")}</BackLink>
      <PageHeader title={t("editTitle")} />
      <I18nProvider locale={locale} messages={pickMessages(locale, ["goals"])}>
        <GoalForm
          action={updateGoalAction.bind(null, goal.id)}
          mode="edit"
          values={{
            name: goal.name,
            targetAmount: goal.targetAmount,
            targetDate: goal.targetDate,
            source: goal.source,
            savedAmount: goal.savedAmount,
            accountIds: goal.accountIds,
            isMain: goal.isMain,
          }}
          accounts={accounts}
          netWorth={netWorth}
          today={today}
        />
        <div className="mt-8 border-t border-line pt-5">
          <DeleteGoalButton action={deleteGoalAction.bind(null, goal.id)} name={goal.name} />
        </div>
      </I18nProvider>
    </>
  );
}
