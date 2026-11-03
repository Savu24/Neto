import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page";
import { I18nProvider } from "@/i18n/client";
import { getLocale, getT, pickMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { scopedDb } from "@/lib/db/scoped";
import { D } from "@/lib/money";
import { loadAccountForEdit } from "@/lib/portfolio/ledger/load";
import { keyFromDate } from "@/lib/portfolio/ledger/service";
import { acceptsTransfers } from "@/lib/portfolio/ledger/types";
import { todayKey } from "@/lib/portfolio/valuation";
import { AccountForm } from "../../account-form";
import { updateAccountAction } from "../../actions";
import { BackLink } from "../../ui";

export const metadata: Metadata = { title: "Edytuj konto" };

const pct = (v: { toString(): string } | null | undefined) =>
  v ? D(v.toString()).times(100).toFixed() : null;

export default async function EditAccountPage({ params }: PageProps<"/assets/[accountId]/edit">) {
  const { user } = await requireUser();
  const { accountId } = await params;
  const sdb = scopedDb(db(), user.id);
  const [t, locale, a] = await Promise.all([getT("assets"), getLocale(), loadAccountForEdit(sdb, accountId)]);
  if (!a) notFound();
  const others = await sdb.financialAccount.findMany({
    where: { archivedAt: null, id: { not: a.id } },
    select: { id: true, name: true, type: true },
  });
  return (
    <>
      <BackLink href={`/assets/${a.id}`}>{t("backToAccount")}</BackLink>
      <PageHeader title={`${t("edit")}: ${a.name}`} meta={t(`type_${a.type}`)} />
      <I18nProvider locale={locale} messages={pickMessages(locale, ["common", "assets"])}>
        <AccountForm
          action={updateAccountAction.bind(null, a.id)}
          mode="edit"
          payoutOptions={others.filter((o) => acceptsTransfers(o.type))}
          today={todayKey()}
          values={{
            name: a.name,
            type: a.type,
            currency: a.currency,
            institution: a.institution,
            taxWrapper: a.taxWrapper,
            ownershipSharePct: D(a.ownershipShare.toString()).times(100).toFixed(),
            includeInNetWorth: a.includeInNetWorth,
            notes: a.notes,
            principal: a.deposit?.principal.toString(),
            ratePct: pct(a.deposit?.rate) ?? undefined,
            startDate: a.deposit ? keyFromDate(a.deposit.startDate) : undefined,
            termMonths: a.deposit?.termMonths,
            capitalization: a.deposit?.capitalization,
            autoRenew: a.deposit?.autoRenew,
            payoutAccountId: a.deposit?.payoutAccountId,
            interestRatePct: pct(a.liability?.interestRate),
            monthlyPayment: a.liability?.monthlyPayment?.toString() ?? null,
            endDate: a.liability?.endDate ? keyFromDate(a.liability.endDate) : null,
            originalAmount: a.liability?.originalAmount?.toString() ?? null,
          }}
        />
      </I18nProvider>
    </>
  );
}
