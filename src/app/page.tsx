import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Disclaimer } from "@/components/page";
import { PublicFooter, PublicHeader, withLink } from "@/components/public";
import { ServiceWorkerRegistration } from "@/components/service-worker";
import { env } from "@/env";
import { getLocale, getT } from "@/i18n/server";
import { getSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getT("marketing"), getLocale()]);
  return {
    metadataBase: new URL(env().APP_URL),
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      url: "/",
      siteName: "Neto",
      title: t("metaTitle"),
      description: t("metaDescription"),
      locale: locale === "pl" ? "pl_PL" : "en_US",
      images: [{ url: "/icons/og.png", width: 1200, height: 630, alt: t("metaTitle") }],
    },
    twitter: { card: "summary_large_image", title: t("metaTitle"), description: t("metaDescription") },
  };
}

const FEATURES = [1, 2, 3, 4, 5, 6] as const;
const NOT_DOING = [1, 2, 3, 4] as const;
const FAQ = [1, 2, 3, 4, 5, 6] as const;

export default async function HomePage() {
  // Zalogowany od razu na pulpit. Sesja czekająca na 2FA zostaje na stronie głównej.
  const session = await getSession().catch(() => null);
  if (session?.session.twoFactorVerified) redirect("/dashboard");

  const [t, nonce] = await Promise.all([
    getT("marketing"),
    headers().then((h) => h.get("x-nonce") ?? undefined),
  ]);

  // Bez ceny i ocen (SPEC: 1.0 bez cen; brak prawdziwych recenzji).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Neto",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    url: env().APP_URL,
    description: t("metaDescription"),
    inLanguage: ["pl", "en"],
  };

  const linkClass = "text-brand underline underline-offset-2";

  return (
    <>
      <PublicHeader />
      <main className="mx-auto w-full max-w-[1120px] px-4 lg:px-8">
        <section className="grid items-center gap-10 pt-10 pb-6 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pt-20 lg:pb-12">
          <div>
            <h1 className="text-[34px] leading-[1.08] font-semibold tracking-tight sm:text-5xl">
              {t("headline")}
            </h1>
            <p className="mt-5 max-w-[56ch] text-[17px] text-ink-2 sm:text-lg">{t("lead")}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="rounded-[10px] bg-brand px-5 py-3 font-semibold text-on-brand"
              >
                {t("signUp")}
              </Link>
              <Link
                href="/login"
                className="rounded-[10px] border border-line bg-surface px-5 py-3 font-semibold"
              >
                {t("signIn")}
              </Link>
            </div>
            <p className="mt-5 max-w-[56ch] text-[13.5px] text-ink-3">{t("heroNote")}</p>
          </div>
          <BalanceIllustration
            label={t("illustrationLabel")}
            legend={[t("illustrationAssets"), t("illustrationLiabilities"), t("illustrationNet")]}
            caption={t("illustrationCaption")}
          />
        </section>

        <section aria-labelledby="funkcje" className="pt-12">
          <h2 id="funkcje" className="text-2xl font-semibold tracking-tight">
            {t("featuresTitle")}
          </h2>
          <ul className="mt-6 grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((n) => (
              <li key={n} className="border-t border-line pt-4">
                <h3 className="font-semibold">{t(`feature${n}Title`)}</h3>
                <p className="mt-1.5 text-ink-2">{t(`feature${n}Body`)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="czego-nie" className="pt-14">
          <h2 id="czego-nie" className="text-2xl font-semibold tracking-tight">
            {t("notTitle")}
          </h2>
          <ul className="mt-5 grid gap-x-10 gap-y-2 sm:grid-cols-2">
            {NOT_DOING.map((n) => (
              <li key={n} className="flex gap-2.5 text-ink-2">
                <span aria-hidden className="mt-[9px] h-0.5 w-3 shrink-0 bg-down" />
                {t(`not${n}`)}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="pytania" className="pt-14">
          <h2 id="pytania" className="text-2xl font-semibold tracking-tight">
            {t("faqTitle")}
          </h2>
          <div className="mt-4 max-w-[760px] border-b border-line">
            {FAQ.map((n) => (
              <details key={n} className="group border-t border-line">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold [&::-webkit-details-marker]:hidden">
                  {t(`faq${n}Q`)}
                  <span
                    aria-hidden
                    className="text-xl leading-none text-ink-3 transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="max-w-[64ch] pb-5 text-ink-2">
                  {n === 6
                    ? withLink(
                        t("faq6A"),
                        <Link href="/delete-account" className={linkClass}>
                          {t("faq6Link")}
                        </Link>,
                      )
                    : t(`faq${n}A`)}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-xl border border-line bg-surface px-5 py-8 sm:px-8">
          <h2 className="text-xl font-semibold tracking-tight">{t("ctaTitle")}</h2>
          <p className="mt-1 text-ink-2">{t("ctaBody")}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/register" className="rounded-[10px] bg-brand px-5 py-3 font-semibold text-on-brand">
              {t("signUp")}
            </Link>
            <Link href="/login" className="rounded-[10px] border border-line px-5 py-3 font-semibold">
              {t("signIn")}
            </Link>
          </div>
        </section>

        <Disclaimer>
          {withLink(
            t("disclaimer"),
            <Link href="/legal/risk" className={linkClass}>
              {t("disclaimerLink")}
            </Link>,
          )}
        </Disclaimer>
      </main>
      <PublicFooter />
      <script
        type="application/ld+json"
        nonce={nonce}
        // JSON-LD bez danych od użytkownika; „<” escapowany, żeby nie dało się zamknąć znacznika.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <ServiceWorkerRegistration />
    </>
  );
}

/**
 * Linia bilansu (SPEC 20): aktywa nad linią zera, zobowiązania pod nią, wartość netto jako linia.
 * Kształt poglądowy, bez kwot i osi, żeby nie sugerował wyników.
 */
function BalanceIllustration({
  label,
  legend,
  caption,
}: {
  label: string;
  legend: string[];
  caption: string;
}) {
  const xs = [0, 80, 160, 240, 320, 400, 480, 560];
  const assets = [70, 64, 68, 56, 60, 48, 42, 34];
  const liabilities = [230, 227, 224, 221, 218, 215, 212, 209];
  const zero = 170;
  const net = assets.map((a, i) => zero - (zero - a - (liabilities[i] - zero)));
  const pts = (ys: number[]) => xs.map((x, i) => `${x},${ys[i]}`).join(" ");
  return (
    <figure className="rounded-xl border border-line bg-surface p-4 sm:p-6">
      <svg viewBox="0 0 560 250" role="img" aria-label={label} className="h-auto w-full">
        <polygon points={`${pts(assets)} 560,${zero} 0,${zero}`} className="fill-brand-soft" />
        <polygon
          points={`0,${zero} 560,${zero} ${pts(liabilities).split(" ").reverse().join(" ")}`}
          className="fill-down-soft"
        />
        <line x1="0" y1={zero} x2="560" y2={zero} className="stroke-ink-3" strokeWidth="1.5" />
        <polyline
          points={pts(net)}
          fill="none"
          className="stroke-brand"
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <figcaption className="mt-4 text-[13px] text-ink-3">
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-ink-2" aria-hidden>
          <li className="flex items-center gap-2">
            <span className="size-3 rounded-sm bg-brand-soft ring-1 ring-line" />
            {legend[0]}
          </li>
          <li className="flex items-center gap-2">
            <span className="size-3 rounded-sm bg-down-soft ring-1 ring-line" />
            {legend[1]}
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1 w-4 rounded-full bg-brand" />
            {legend[2]}
          </li>
        </ul>
        <p className="mt-2">{caption}</p>
      </figcaption>
    </figure>
  );
}
