import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { features } from "@/env";
import { getT } from "@/i18n/server";
import { safeNext } from "@/lib/auth/paths";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "../forms";
import { RedirectNotice } from "../notice";

export const metadata: Metadata = { title: "Logowanie" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const current = await getSession();
  if (current?.session.twoFactorVerified) redirect(next);

  const t = await getT("auth");
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("loginTitle")}</h1>
      <RedirectNotice notice={params.notice} />
      {features().googleLogin ? (
        <>
          <a
            href="/api/auth/google"
            className="flex h-11 items-center justify-center rounded-[10px] border border-line bg-surface font-semibold"
          >
            {t("google")}
          </a>
          <p className="text-center text-sm text-ink-3">{t("orDivider")}</p>
        </>
      ) : null}
      <LoginForm next={next} />
      <p className="text-sm text-ink-2">
        {t("noAccount")} <Link href="/register">{t("signUp")}</Link>
      </p>
    </div>
  );
}
