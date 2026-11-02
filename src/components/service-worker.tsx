"use client";

import { useEffect } from "react";

/**
 * Rejestruje /sw.js (powłoka i strona offline, bez danych finansowych). Tylko w buildzie produkcyjnym,
 * żeby worker nie przechowywał plików serwera deweloperskiego. Na razie montowany na stronach publicznych;
 * docelowo w layoucie głównym (plik wspólny, zmiana opisana w raporcie Etapu 10).
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Bez workera aplikacja działa normalnie, tylko bez strony offline.
    });
  }, []);
  return null;
}
