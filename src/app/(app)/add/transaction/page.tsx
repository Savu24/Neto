import type { Metadata } from "next";
import { PageHeader } from "@/components/page";
import { I18nProvider } from "@/i18n/client";
import { getLocale, getT, pickMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { scopedDb } from "@/lib/db/scoped";
import { formatNumber } from "@/lib/format";
import { acceptsTransfers, valuationOf } from "@/lib/portfolio/ledger/types";
import { todayKey } from "@/lib/portfolio/valuation";
import { BackLink } from "../../assets/ui";
import { TransactionForm } from "./transaction-form";

export const metadata: Metadata = { title: "Dodaj transakcję" };

export default async function AddTransactionPage({ searchParams }: PageProps<"/add/transaction">) {
  const { user } = await requireUser();
  const sp = await searchParams;
  const sdb = scopedDb(db(), user.id);
  const [t, tn, locale] = await Promise.all([getT("transactions"), getT("nav"), getLocale()]);
  const all = await sdb.financialAccount.findMany({
    where: { archivedAt: null },
    select: { id: true, name: true, type: true, currency: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  // Lokatę kończy przycisk na ekranie lokaty; tutaj konta z formularzem transakcji.
  const accounts = all.filter((a) => valuationOf(a.type) !== "deposit");
  const holdings = await sdb.holding.findMany({
    where: { accountId: { in: accounts.map((a) => a.id) }, quantity: { gt: 0 } },
    include: { asset: { select: { name: true, symbol: true, currency: true } } },
  });
  const accountParam = typeof sp.account === "string" ? sp.account : undefined;
  const assetParam = typeof sp.asset === "string" ? sp.asset : undefined;
  const asset = assetParam ? await sdb.asset.findUnique({ where: { id: assetParam } }) : null;

  return (
    <>
      <BackLink href={accountParam ? `/assets/${accountParam}` : "/add"}>{tn("add")}</BackLink>
      <PageHeader title={t("addTitle")} />
      <I18nProvider locale={locale} messages={pickMessages(locale, ["common", "assets", "transactions"])}>
        <TransactionForm
          accounts={accounts}
          transferTargets={all.filter((a) => acceptsTransfers(a.type))}
          holdings={holdings.map((h) => ({
            accountId: h.accountId,
            assetId: h.assetId,
            name: h.asset.name,
            symbol: h.asset.symbol,
            currency: h.asset.currency,
            quantity: formatNumber(h.quantity.toString(), locale, 6),
          }))}
          initialAccountId={accounts.some((a) => a.id === accountParam) ? accountParam : undefined}
          initialAsset={
            asset
              ? {
                  id: asset.id,
                  name: asset.name,
                  symbol: asset.symbol,
                  isin: asset.isin,
                  exchange: asset.exchange,
                  assetClass: asset.assetClass,
                  currency: asset.currency,
                  own: asset.userId !== null,
                }
              : null
          }
          today={todayKey()}
        />
      </I18nProvider>
    </>
  );
}
