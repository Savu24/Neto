import type { Metadata } from "next";
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
      <EmptyState
        title={t("emptyTitle")}
        body={t("emptyBody")}
        action={{ href: "/add", label: t("newGoal") }}
      />
      <Disclaimer>{tc("disclaimerSimulation")}</Disclaimer>
    </>
  );
}
