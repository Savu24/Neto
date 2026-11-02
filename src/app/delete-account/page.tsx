import { LegalDocumentView, legalMetadata } from "../legal/legal-document";

// Publiczna strona „Jak usunąć konto”, bez logowania. Stały adres podawany w App Store Connect.
export async function generateMetadata({ searchParams }: PageProps<"/delete-account">) {
  return legalMetadata("delete-account", (await searchParams).lang);
}

export default async function DeleteAccountPage({ searchParams }: PageProps<"/delete-account">) {
  return <LegalDocumentView slug="delete-account" lang={(await searchParams).lang} />;
}
