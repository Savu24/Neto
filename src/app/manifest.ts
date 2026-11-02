import type { MetadataRoute } from "next";

// Kolory jak themeColor w layoucie głównym (tło jasnego motywu) i marka z SPEC 20.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Neto",
    short_name: "Neto",
    description:
      "Cały majątek w jednej liczbie: konta, inwestycje, nieruchomości i kredyty wyceniane codziennie.",
    lang: "pl",
    dir: "ltr",
    // Zainstalowana aplikacja startuje od pulpitu; bez sesji proxy przekieruje do logowania.
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f1f4f2",
    theme_color: "#f1f4f2",
    categories: ["finance"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
