import type { Metadata } from "next";
import { PageHeader } from "@/components/page";
import { getT } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";
import { DeleteAccountForm } from "./forms";

export const metadata: Metadata = { title: "Twoje dane" };

export default async function DataPage() {
  await requireUser();
  const t = await getT("settings");
  return (
    <>
      <PageHeader title={t("data")} meta={t("dataLead")} />
      <section className="grid gap-3 py-5">
        <h2 className="text-base font-semibold">{t("exportTitle")}</h2>
        <p className="text-ink-2">{t("exportLead")}</p>
        {/* Zwykły link: przeglądarka pobiera plik, iOS w Etapie 11 przejmie go arkuszem udostępniania. */}
        <a
          href="/api/export"
          download
          className="inline-flex h-11 items-center justify-self-start rounded-[10px] border border-line px-4 font-semibold text-brand"
        >
          {t("exportAction")}
        </a>
      </section>
      <section className="grid gap-3 border-t border-line py-5">
        <h2 className="text-base font-semibold text-down">{t("deleteTitle")}</h2>
        <p className="max-w-[65ch] text-ink-2">{t("deleteLead")}</p>
        <DeleteAccountForm />
      </section>
    </>
  );
}
