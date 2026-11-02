import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/page";
import { getT } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Dodaj" };

// Etap 5: wybór „transakcja / konto / import CSV”.
export default async function AddPage() {
  await requireUser();
  const [t, tn, tc] = await Promise.all([getT("assets"), getT("nav"), getT("common")]);
  return (
    <>
      <PageHeader title={tn("add")} meta={tc("demoBadge")} />
      <EmptyState title={t("addAccount")} body={t("emptyBody")} />
    </>
  );
}
