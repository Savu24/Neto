import type { Metadata } from "next";
import { ServiceWorkerRegistration } from "@/components/service-worker";
import { getT } from "@/i18n/server";
import { RetryButton } from "./retry-button";

export const metadata: Metadata = { robots: { index: false } };

/**
 * Strona „Brak połączenia” (SPEC 6, 10). Service worker zapisuje ją przy instalacji i pokazuje
 * zamiast każdej nawigacji bez sieci. Nie może zawierać żadnych danych użytkownika.
 */
export default async function OfflinePage() {
  const t = await getT("marketing");
  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col justify-center px-4 py-16">
      <p className="text-[22px] font-bold tracking-tight text-brand">Neto</p>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">{t("offlineTitle")}</h1>
      <p className="mt-2 text-ink-2">{t("offlineBody")}</p>
      <RetryButton label={t("offlineRetry")} />
      <ServiceWorkerRegistration />
    </main>
  );
}
