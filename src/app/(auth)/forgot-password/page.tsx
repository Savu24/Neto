import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/i18n/server";
import { ForgotForm } from "../forms";

export const metadata: Metadata = { title: "Reset hasła" };

export default async function ForgotPasswordPage() {
  const t = await getT("auth");
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("forgotTitle")}</h1>
        <p className="mt-2 text-ink-2">{t("forgotLead")}</p>
      </div>
      <ForgotForm />
      <Link href="/login" className="text-sm">
        {t("signIn")}
      </Link>
    </div>
  );
}
