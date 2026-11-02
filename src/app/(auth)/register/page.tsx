import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import Script from "next/script";
import { env, features } from "@/env";
import { getT } from "@/i18n/server";
import { RegisterForm } from "../forms";

export const metadata: Metadata = { title: "Załóż konto" };

export default async function RegisterPage() {
  const t = await getT("auth");
  const botSiteKey = features().botProtection ? (env().BOT_PROTECTION_SITE_KEY ?? null) : null;
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("registerTitle")}</h1>
        <p className="mt-2 text-ink-2">{t("registerLead")}</p>
      </div>
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
      <RegisterForm botSiteKey={botSiteKey} />
      {botSiteKey ? (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" nonce={nonce} async defer />
      ) : null}
      <p className="text-sm text-ink-2">
        {t("haveAccount")} <Link href="/login">{t("signIn")}</Link>
      </p>
    </div>
  );
}
