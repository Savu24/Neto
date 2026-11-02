import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/i18n/server";
import { VerifyEmailForm } from "../forms";

export const metadata: Metadata = { title: "Potwierdzenie e-maila", referrer: "no-referrer" };

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const { token } = await searchParams;
  const t = await getT("auth");
  const ts = await getT("settings");
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{ts("emailStatus")}</h1>
      {typeof token === "string" ? (
        <VerifyEmailForm token={token} label={t("twoFactorSubmit")} />
      ) : (
        <p role="alert">{t("verifyFailed")}</p>
      )}
      <Link href="/dashboard" className="text-sm">
        {t("signIn")}
      </Link>
    </div>
  );
}
