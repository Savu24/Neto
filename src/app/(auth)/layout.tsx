import Link from "next/link";
import { I18nProvider } from "@/i18n/client";
import { getLocale, pickMessages } from "@/i18n/server";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <I18nProvider locale={locale} messages={pickMessages(locale, ["common", "auth"])}>
      <div className="mx-auto flex min-h-dvh max-w-[440px] flex-col px-4 pt-10 pb-16">
        <Link href="/" className="text-[22px] font-bold tracking-tight text-brand">
          Neto
        </Link>
        <main className="mt-8">{children}</main>
      </div>
    </I18nProvider>
  );
}
