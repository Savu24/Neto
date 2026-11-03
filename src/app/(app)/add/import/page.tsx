import type { Metadata } from "next";
import { PageHeader } from "@/components/page";
import { I18nProvider } from "@/i18n/client";
import { getLocale, getT, pickMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { scopedDb } from "@/lib/db/scoped";
import { formatDate } from "@/lib/format";
import { recentImports } from "@/lib/portfolio/import/service";
import { acceptsTransfers } from "@/lib/portfolio/ledger/types";
import { todayKey } from "@/lib/portfolio/valuation";
import { BackLink, Row, Rows, Section, Tag } from "../../assets/ui";
import { ImportWizard, RevertButton } from "./import-wizard";

export const metadata: Metadata = { title: "Import CSV" };

export default async function ImportPage({ searchParams }: PageProps<"/add/import">) {
  const { user } = await requireUser();
  const sp = await searchParams;
  const sdb = scopedDb(db(), user.id);
  const [t, tn, locale] = await Promise.all([getT("import"), getT("nav"), getLocale()]);
  const accounts = (
    await sdb.financialAccount.findMany({
      where: { archivedAt: null },
      select: { id: true, name: true, type: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    })
  ).filter((a) => acceptsTransfers(a.type));
  const recent = await recentImports({ db: sdb, userId: user.id, today: todayKey() });
  const accountParam = typeof sp.account === "string" ? sp.account : undefined;

  return (
    <>
      <BackLink href={accountParam ? `/assets/${accountParam}` : "/add"}>{tn("add")}</BackLink>
      <PageHeader title={t("title")} meta={t("lead")} />
      <I18nProvider locale={locale} messages={pickMessages(locale, ["common", "import", "transactions"])}>
        <ImportWizard
          accounts={accounts}
          initialAccountId={accounts.some((a) => a.id === accountParam) ? accountParam : undefined}
        />
        {recent.length > 0 ? (
          <Section title={t("recent")}>
            <Rows>
              {recent.map((b) => (
                <Row
                  key={b.id}
                  name={b.fileName}
                  sub={t("recentRow", {
                    file: b.fileName,
                    date: formatDate(b.createdAt, locale),
                    imported: b.imported,
                    skipped: b.skipped,
                  })}
                  value={
                    b.status === "REVERTED" ? (
                      <Tag>{t("reverted")}</Tag>
                    ) : b.canRevert ? (
                      <RevertButton batchId={b.id} label={t("undo")} />
                    ) : null
                  }
                />
              ))}
            </Rows>
          </Section>
        ) : null}
      </I18nProvider>
    </>
  );
}
