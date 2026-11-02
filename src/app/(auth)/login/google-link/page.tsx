import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/i18n/server";
import { readPendingGoogle } from "@/lib/auth/google";
import { GoogleLinkForm } from "../../forms";

export const metadata: Metadata = { title: "Połącz konto Google" };

export default async function GoogleLinkPage() {
  const profile = await readPendingGoogle();
  if (!profile) redirect("/login");
  const t = await getT("auth");
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("googleLinkTitle")}</h1>
        <p className="mt-2 text-ink-2">{t("googleLinkLead", { email: profile.email })}</p>
      </div>
      <GoogleLinkForm />
    </div>
  );
}
