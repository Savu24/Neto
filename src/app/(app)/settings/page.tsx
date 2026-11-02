import type { Metadata } from "next";
import { cookies } from "next/headers";
import { PageHeader } from "@/components/page";
import { getLocale, getT } from "@/i18n/server";
import { THEME_COOKIE, parseTheme, themes } from "@/lib/theme";
import { setPreference } from "./actions";

export const metadata: Metadata = { title: "Ustawienia" };

const themeLabel = { system: "themeSystem", light: "themeLight", dark: "themeDark" } as const;

export default async function SettingsPage() {
  const [t, locale, store] = await Promise.all([getT("settings"), getLocale(), cookies()]);
  const theme = parseTheme(store.get(THEME_COOKIE)?.value);

  return (
    <>
      <PageHeader title={t("title")} />
      <section className="py-4.5">
        <h2 className="mb-1 text-sm font-semibold text-ink-2">{t("appearance")}</h2>
        <ul className="rounded-xl border border-line bg-surface px-3.5">
          <li className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3">
            <span id="theme-label">{t("theme")}</span>
            <Segmented
              name="theme"
              labelledBy="theme-label"
              value={theme}
              options={themes.map((v) => ({ value: v, label: t(themeLabel[v]) }))}
            />
          </li>
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
