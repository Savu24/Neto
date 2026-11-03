import type { Metadata } from "next";
import { PageHeader } from "@/components/page";
import { I18nProvider } from "@/i18n/client";
import { getLocale, getT, pickMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { scopedDb } from "@/lib/db/scoped";
import { todayKey } from "@/lib/portfolio/valuation";
import { BackLink } from "../../assets/ui";
import { createGoalAction } from "../actions";
import { goalFormData } from "../form-data";
import { GoalForm } from "../goal-form";

export const metadata: Metadata = { title: "Nowy cel" };

export default async function NewGoalPage() {
  const { user } = await requireUser();
  const [t, locale] = await Promise.all([getT("goals"), getLocale()]);
  const today = todayKey();
  const { accounts, netWorth } = await goalFormData(scopedDb(db(), user.id), today);
  return (
    <>
      <BackLink href="/goals">{t("back")}</BackLink>
      <PageHeader title={t("newTitle")} />
      <I18nProvider locale={locale} messages={pickMessages(locale, ["goals"])}>
        <GoalForm
          action={createGoalAction}
          mode="create"
          accounts={accounts}
          netWorth={netWorth}
          today={today}
        />
      </I18nProvider>
    </>
  );
}
