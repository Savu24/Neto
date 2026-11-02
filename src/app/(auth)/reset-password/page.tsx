import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { ResetForm } from "../forms";

export const metadata: Metadata = { title: "Nowe hasło", referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  const t = await getT("auth");
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("resetTitle")}</h1>
      {typeof token === "string" ? (
        <ResetForm token={token} />
      ) : (
        <p role="alert">{t("error_invalid_token")}</p>
      )}
    </div>
  );
}
