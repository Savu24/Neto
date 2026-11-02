import Link from "next/link";
import { getT } from "@/i18n/server";

// Tymczasowa strona startowa; strona marketingowa powstaje w Etapie 10.
export default async function HomePage() {
  const [t, tc] = await Promise.all([getT("marketing"), getT("common")]);
  return (
    <main className="mx-auto flex min-h-dvh max-w-[760px] flex-col justify-center px-4 py-16">
      <p className="text-[22px] font-bold tracking-tight text-brand">{tc("appName")}</p>
      <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">{t("headline")}</h1>
      <p className="mt-4 max-w-[60ch] text-lg text-ink-2">{t("lead")}</p>
      <Link
        href="/dashboard"
        className="mt-8 self-start rounded-[10px] bg-brand px-5 py-3 font-semibold text-on-brand"
      >
        {t("openApp")}
      </Link>
    </main>
  );
}
