import Link from "next/link";
import { I18nProvider } from "@/i18n/client";
import { getLocale, pickMessages } from "@/i18n/server";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <I18nProvider locale={locale} messages={pickMessages(locale, ["common", "auth"])}>
      <div className="mx-auto flex min-h-dvh max-w-[460px] flex-col px-4 pt-10 pb-16 sm:pt-16">
        <Link
          href="/"
          className="flex items-center gap-2.5 self-start text-[20px] font-bold tracking-tight text-ink"
        >
          <span
            aria-hidden
            className="grid size-8 place-items-center rounded-[9px] bg-brand text-[17px] font-bold text-on-brand"
          >
            N
          </span>
          Neto
        </Link>
        <main className="mt-6 rounded-2xl border border-line bg-surface px-5 py-7 shadow-card sm:px-8 sm:py-9">
          {children}
        </main>
      </div>
    </I18nProvider>
  );
}
