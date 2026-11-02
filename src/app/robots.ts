import type { MetadataRoute } from "next";
import { env } from "@/env";

export const dynamic = "force-dynamic";

/**
 * Bez wyliczania ścieżek aplikacji: i tak wymagają logowania (proxy przekierowuje do /login),
 * a lista w robots.txt tylko by je ogłaszała. Strony bez indeksowania mają noindex w metadanych.
 */
export default function robots(): MetadataRoute.Robots {
  const base = env().APP_URL.replace(/\/$/, "");
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${base}/sitemap.xml`,
  };
}
