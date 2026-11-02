/**
 * Źródło service workera (SPEC 10): tylko powłoka aplikacji i strona „Brak połączenia”.
 * Dane finansowe nigdy nie trafiają do pamięci podręcznej: odpowiedzi na nawigacje (HTML z danymi),
 * żądania RSC, API i akcje serwera idą wyłącznie przez sieć. Do pamięci trafiają tylko pliki
 * z `/_next/static/` (kod i style z hashem w nazwie), ikony, manifest i strona offline.
 *
 * Wersja zmienia się z każdym buildem, więc przeglądarka instaluje nowego workera,
 * a stara pamięć jest usuwana w `activate`.
 */
export const OFFLINE_PATH = "/offline";

export function serviceWorkerSource(version: string): string {
  return `"use strict";
const SHELL = "neto-shell-${version}";
const OFFLINE_URL = ${JSON.stringify(OFFLINE_PATH)};
const PRECACHE = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

function isShellAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      const res = await fetch(OFFLINE_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("offline page " + res.status);
      const html = await res.clone().text();
      await cache.put(OFFLINE_URL, res);
      // Kod i style, których potrzebuje strona offline.
      const assets = Array.from(new Set(html.match(/\\/_next\\/static\\/[^"'\\s<>)\\\\]+/g) || []));
      await cache.addAll(PRECACHE.concat(assets));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("neto-") && n !== SHELL).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    // Zawsze sieć; bez połączenia strona offline. Odpowiedzi nie zapisujemy.
    event.respondWith(
      fetch(req).catch(async () => (await caches.match(OFFLINE_URL, { cacheName: SHELL })) || Response.error()),
    );
    return;
  }

  if (isShellAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok && res.type === "basic") cache.put(req, res.clone());
        return res;
      })(),
    );
  }
  // Reszta (RSC, API, akcje serwera, strony z danymi) bez udziału workera.
});
`;
}
