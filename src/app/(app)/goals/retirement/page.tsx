import type { Metadata } from "next";
import Link from "next/link";
import { Disclaimer, PageHeader } from "@/components/page";
import { I18nProvider } from "@/i18n/client";
import { getLocale, getT, pickMessages } from "@/i18n/server";
import { RetirementCalculator } from "./calculator";
import { loadRetirementDefaults } from "./defaults";

export const metadata: Metadata = { title: "Kalkulator emerytury" };

export default async function RetirementPage() {
  const [t, tc, locale, defaults] = await Promise.all([
    getT("retirement"),
    getT("common"),
    getLocale(),
    loadRetirementDefaults(),
  ]);

  return (
    <>
      <Link href="/goals" className="mt-3.5 inline-flex text-[13px] text-ink-2 hover:text-brand lg:mt-5">
        ← {t("backToGoals")}
      </Link>
      <PageHeader title={t("title")} />
      {/* Layout (app) przekazuje klientowi tylko common, nav i settings; zakres retirement dokładamy tutaj. */}
      <I18nProvider locale={locale} messages={pickMessages(locale, ["common", "retirement"])}>
        <RetirementCalculator defaults={defaults} />
      </I18nProvider>
      <Disclaimer>{tc("disclaimerResults")}</Disclaimer>
    </>
  );
}
