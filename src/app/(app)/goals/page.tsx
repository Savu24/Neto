import type { Metadata } from "next";
import Link from "next/link";
import { Disclaimer, EmptyState, PageHeader } from "@/components/page";
import { getT } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Cele" };

export default async function GoalsPage() {
  await requireUser();
  const [t, tc] = await Promise.all([getT("goals"), getT("common")]);
  return (
    <>
      <PageHeader title={t("title")} meta={tc("demoBadge")} />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-12">
        <EmptyState
          title={t("emptyTitle")}
          body={t("emptyBody")}
          action={{ href: "/add", label: t("newGoal") }}
        />
        <section
          aria-labelledby="retirement-card"
          className="mt-6 border-t border-line pt-5 lg:mt-4 lg:border-0 lg:pt-0"
        >
          <h2 id="retirement-card" className="text-base font-semibold">
            {t("calculatorTitle")}
          </h2>
          <p className="mt-1 max-w-[60ch] text-ink-2">{t("calculatorBody")}</p>
          <Link
            href="/goals/retirement"
            className="mt-4 inline-flex rounded-[10px] border border-line bg-surface px-4 py-2.5 font-semibold text-brand"
          >
            {t("calculatorLink")}
          </Link>
        </section>
      </div>
      <Disclaimer>{tc("disclaimerResults")}</Disclaimer>
    </>
  );
}
