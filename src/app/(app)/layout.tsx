import { AppNav } from "@/components/app-nav";
import { I18nProvider } from "@/i18n/client";
import { getLocale, pickMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Layout nie zastępuje kontroli na stronach i w akcjach (każda woła requireUser), ale nie renderuje
  // nawigacji bez sesji. Proxy wcześniej przekierowuje żądania bez ciasteczka.
  await requireUser();
  const locale = await getLocale();

  return (
    <I18nProvider locale={locale} messages={pickMessages(locale, ["common", "nav", "settings"])}>
      <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
        <AppNav />
        <main className="mx-auto w-full max-w-[1180px] px-4 pb-28 lg:px-10 lg:pb-12">{children}</main>
      </div>
    </I18nProvider>
  );
}
