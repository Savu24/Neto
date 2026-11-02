import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/i18n/server";
import { safeNext } from "@/lib/auth/paths";
import { getSession } from "@/lib/auth/session";
import { logoutAction } from "../../actions";
import { TwoFactorForm } from "../../forms";
import { RedirectNotice } from "../../notice";

export const metadata: Metadata = { title: "Weryfikacja dwuetapowa" };

export default async function TwoFactorPage({ searchParams }: PageProps<"/login/2fa">) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const current = await getSession();
  if (!current) redirect("/login");
  if (current.session.twoFactorVerified) redirect(next);

  const t = await getT("auth");
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("twoFactorTitle")}</h1>
      <RedirectNotice notice={params.notice} />
      <p className="text-ink-2">{t("twoFactorLead")}</p>
      <TwoFactorForm next={next} />
      <form action={logoutAction}>
        <button type="submit" className="text-sm text-brand">
          {t("useOtherAccount")}
        </button>
      </form>
    </div>
  );
}
