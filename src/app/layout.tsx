import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import { getLocale } from "@/i18n/server";
import "./globals.css";

const schibsted = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Neto", template: "%s · Neto" },
  description:
    "Cały majątek w jednej liczbie: konta, inwestycje, nieruchomości i kredyty wyceniane codziennie.",
  applicationName: "Neto",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Treść pod wycięciem i paskiem domowym iPhone'a; odstępy dają zmienne env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: "#f4f6fa",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();

  return (
    <html lang={locale} className={`${schibsted.variable} h-full antialiased`}>
      <body className="min-h-full font-sans text-[15px] leading-[1.45]">{children}</body>
    </html>
  );
}
