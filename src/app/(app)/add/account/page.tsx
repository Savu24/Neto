import type { Metadata } from "next";
import { PageHeader } from "@/components/page";
import { I18nProvider } from "@/i18n/client";
import { getLocale, getT, pickMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { scopedDb } from "@/lib/db/scoped";
import { acceptsTransfers } from "@/lib/portfolio/ledger/types";
import { todayKey } from "@/lib/portfolio/valuation";
import { AccountForm } from "../../assets/account-form";
import { createAccountAction } from "../../assets/actions";
import { BackLink } from "../../assets/ui";

export const metadata: Metadata = { title: "Dodaj konto" };

export default async function AddAccountPage() {
  const { user } = await requireUser();
  const [t, tn, locale] = await Promise.all([getT("assets"), getT("nav"), getLocale()]);
  const accounts = await scopedDb(db(), user.id).financialAccount.findMany({
    where: { archivedAt: null },
    select: { id: true, name: true, type: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return (
    <>
      <BackLink href="/add">{tn("add")}</BackLink>
      <PageHeader title={t("addAccount")} />
      <I18nProvider locale={locale} messages={pickMessages(locale, ["common", "assets"])}>
        <AccountForm
          action={createAccountAction}
          mode="create"
          payoutOptions={accounts.filter((a) => acceptsTransfers(a.type))}
          today={todayKey()}
        />
      </I18nProvider>
    </>
  );
}
