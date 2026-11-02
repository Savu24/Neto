import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import { cookies } from "next/headers";
import { getLocale } from "@/i18n/server";
import { THEME_COOKIE, parseTheme, themeAttribute } from "@/lib/theme";
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f4f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1519" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [locale, cookieStore] = await Promise.all([getLocale(), cookies()]);
  const theme = themeAttribute(parseTheme(cookieStore.get(THEME_COOKIE)?.value));

  return (
    <html lang={locale} data-theme={theme} className={`${schibsted.variable} h-full antialiased`}>
      <body className="min-h-full font-sans text-[15px] leading-[1.45]">{children}</body>
    </html>
  );
}
