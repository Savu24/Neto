import type { Metadata } from "next";
import { Disclaimer, EmptyState, PageHeader } from "@/components/page";
import { getT } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Pulpit" };

export default async function DashboardPage() {
  await requireUser();
  const [t, tc] = await Promise.all([getT("dashboard"), getT("common")]);
  return (
    <>
      <PageHeader title={t("title")} meta={tc("demoBadge")} />
      <EmptyState
        title={t("emptyTitle")}
        body={t("emptyBody")}
        action={{ href: "/add", label: t("emptyAction") }}
      />
      <Disclaimer>{tc("disclaimerResults")}</Disclaimer>
    </>
  );
}
