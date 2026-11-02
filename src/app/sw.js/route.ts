import { serviceWorkerSource } from "@/lib/pwa/service-worker";

// Generowany przy buildzie: wersja = czas buildu, więc każde wdrożenie podmienia workera i jego pamięć.
export const dynamic = "force-static";

const VERSION = Date.now().toString(36);

export function GET() {
  return new Response(serviceWorkerSource(VERSION), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Przeglądarka zawsze sprawdza nową wersję workera.
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
