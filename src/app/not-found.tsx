import Link from "next/link";
import { getT } from "@/i18n/server";

export default async function NotFound() {
  const t = await getT("errors");
  return (
    <main className="mx-auto max-w-[640px] px-4 py-20">
      <h1 className="text-2xl font-semibold">{t("notFoundTitle")}</h1>
      <p className="mt-2 text-ink-2">{t("notFoundBody")}</p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex rounded-[10px] bg-brand px-4 py-2.5 font-semibold text-on-brand"
      >
        {t("notFoundAction")}
      </Link>
    </main>
  );
}
