import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page";
import { getLocale, getT } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";
import { logoutAction } from "../../(auth)/actions";
import { setPreference } from "./actions";

export const metadata: Metadata = { title: "Ustawienia" };

export default async function SettingsPage() {
  const { user } = await requireUser();
  const [t, locale] = await Promise.all([getT("settings"), getLocale()]);

  return (
    <>
      <PageHeader title={t("title")} meta={user.email} />
      <section className="py-4.5">
        <ul className="rounded-xl border border-line bg-surface px-3.5 shadow-card">
          <li className="border-b border-line py-3">
            <Link href="/settings/security" className="flex justify-between">
              <span>{t("security")}</span>
              <span className="text-sm text-ink-2">
                {user.totpEnabledAt ? t("twoFactorOn") : t("twoFactorOff")}
              </span>
            </Link>
          </li>
          <li className="py-3">
            <Link href="/settings/data">{t("data")}</Link>
          </li>
        </ul>
      </section>
      <section className="py-4.5">
        <h2 className="mb-1 text-sm font-semibold text-ink-2">{t("appearance")}</h2>
        <ul className="rounded-xl border border-line bg-surface px-3.5 shadow-card">
          <li className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3">
            <span id="locale-label">{t("language")}</span>
            <Segmented
              name="locale"
              labelledBy="locale-label"
              value={locale}
              options={[
                { value: "pl", label: t("languagePl") },
                { value: "en", label: t("languageEn") },
              ]}
            />
          </li>
          <li className="flex items-center justify-between gap-3 py-3">
            <span>{t("baseCurrency")}</span>
            <span className="text-sm text-ink-2">{t("baseCurrencyValue")}</span>
          </li>
        </ul>
      </section>
      <form action={logoutAction} className="py-4.5">
        <button
          type="submit"
          className="h-11 rounded-[10px] border border-line-strong bg-surface px-4 font-semibold text-ink shadow-card transition-colors hover:bg-surface-2"
        >
          {t("signOut")}
        </button>
      </form>
    </>
  );
}

/** Przełącznik działa bez JavaScriptu: każdy przycisk wysyła formularz z jedną wartością. */
function Segmented({
  name,
  value,
  options,
  labelledBy,
}: {
  name: string;
  value: string;
  labelledBy: string;
  options: { value: string; label: string }[];
}) {
  return (
    <form
      action={setPreference}
      role="group"
      aria-labelledby={labelledBy}
      className="inline-flex gap-0.5 rounded-[9px] border border-line bg-surface p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="submit"
          name={name}
          value={o.value}
          aria-pressed={o.value === value}
          className="rounded-[7px] px-2.5 py-1 text-[13px] text-ink-2 aria-pressed:bg-brand aria-pressed:font-semibold aria-pressed:text-on-brand"
        >
          {o.label}
        </button>
      ))}
    </form>
  );
}
