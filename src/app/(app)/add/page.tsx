import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page";
import { getT } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Dodaj" };

/** Wybór: transakcja, konto lub aktywo, import CSV, cel (SPEC 6: środkowy przycisk „Dodaj”). */
export default async function AddPage() {
  await requireUser();
  const [t, tg, tn] = await Promise.all([getT("assets"), getT("goals"), getT("nav")]);
  const options = [
    { href: "/add/transaction", title: t("addTransaction"), body: t("addTransactionHint") },
    { href: "/add/account", title: t("addAccountOrAsset"), body: t("addAccountHint") },
    { href: "/goals/new", title: tg("newGoal"), body: tg("addGoalHint") },
    { href: "/add/import", title: t("addImport"), body: t("addImportHint") },
  ];
  return (
    <>
      <PageHeader title={tn("add")} meta={t("addLead")} />
      <ul className="grid gap-3 sm:grid-cols-2">
        {options.map((o) => (
          <li key={o.href}>
            <Link
              href={o.href}
              className="block h-full rounded-xl border border-line bg-surface p-4 hover:border-brand lg:p-5"
            >
              <span className="block text-base font-semibold text-brand">{o.title}</span>
              <span className="mt-1 block text-[14px] text-ink-2">{o.body}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
