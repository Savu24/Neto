import { notFound, permanentRedirect } from "next/navigation";
import { isLegalSlug, legalHref } from "@/lib/legal/documents";
import { LegalDocumentView, legalMetadata } from "../legal-document";

export async function generateMetadata({ params, searchParams }: PageProps<"/legal/[doc]">) {
  const [{ doc }, { lang }] = await Promise.all([params, searchParams]);
  return isLegalSlug(doc) ? legalMetadata(doc, lang) : {};
}

export default async function LegalPage({ params, searchParams }: PageProps<"/legal/[doc]">) {
  const [{ doc }, { lang }] = await Promise.all([params, searchParams]);
  if (!isLegalSlug(doc)) notFound();
  // Usuwanie konta ma stały, krótki adres (App Store Connect).
  if (doc === "delete-account")
    permanentRedirect(legalHref(doc) + (typeof lang === "string" ? `?lang=${encodeURIComponent(lang)}` : ""));
  return <LegalDocumentView slug={doc} lang={lang} />;
}
