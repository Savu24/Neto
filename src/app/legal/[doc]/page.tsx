import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getT } from "@/i18n/server";

// Tymczasowo: treści dokumentów powstają w Etapie 12 (szkice do zatwierdzenia przez radcę),
// a strony z pełną treścią w Etapie 10.
const DOCS = { terms: "terms", privacy: "privacy" } as const;

export const metadata: Metadata = { robots: { index: false } };

export default async function LegalPage({ params }: PageProps<"/legal/[doc]">) {
  const { doc } = await params;
  if (!(doc in DOCS)) notFound();
  const t = await getT("legal");
  return (
    <main className="mx-auto max-w-[70ch] px-4 py-16">
      <Link href="/" className="text-[22px] font-bold tracking-tight text-brand">
        Neto
      </Link>
      <h1 className="mt-8 text-2xl font-semibold">{t(DOCS[doc as keyof typeof DOCS])}</h1>
      <p className="mt-4 text-ink-2">{t("draftNotice")}</p>
    </main>
  );
}
