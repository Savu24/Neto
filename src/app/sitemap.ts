import type { MetadataRoute } from "next";
import { env } from "@/env";
import { LEGAL_DRAFT, legalHref, legalSlugs } from "@/lib/legal/documents";

// Adres z APP_URL w chwili żądania (ten sam build działa pod różnymi domenami).
export const dynamic = "force-dynamic";

/** Tylko strony publiczne; ścieżki aplikacji (/dashboard itd.) i strona offline celowo pominięte. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = env().APP_URL.replace(/\/$/, "");
  const legal = LEGAL_DRAFT ? [] : legalSlugs.map((slug) => ({ url: base + legalHref(slug) }));
  return [{ url: `${base}/`, changeFrequency: "monthly", priority: 1 }, ...legal];
}
