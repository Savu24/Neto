import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { runNightlyValuation } from "@/lib/portfolio/snapshots/nightly";
import { todayKey } from "@/lib/portfolio/valuation";
import { getPricing } from "@/lib/pricing/server";
import { rejectCron } from "../auth";

/** Limit funkcji na planie Hobby; nowych użytkowników nie zaczynamy po `BUDGET_MS` (odpowiedź `more: true`). */
export const maxDuration = 60;
const BUDGET_MS = 45_000;

/**
 * Nocna wycena (vercel.json, SPEC 7.7): kursy NBP → ceny rynkowe (jeśli jest dostawca) → migawki
 * `PortfolioSnapshot` i kolejka „przelicz od D”. Logika w `src/lib/portfolio/snapshots`. Vercel wysyła Bearer CRON_SECRET.
 */
export async function GET(request: Request) {
  const rejected = rejectCron(request);
  if (rejected) return rejected;
  const started = Date.now();
  const today = todayKey();
  try {
    // Ceny ręczne są już w PriceSnapshot; cron korzysta tylko z kursów i dostawcy rynkowego.
    const pricing = getPricing({ manualPrices: async () => [] });
    const result = await runNightlyValuation({ base: db(), pricing, today, deadline: started + BUDGET_MS });
    return NextResponse.json({ ...result, ms: Date.now() - started });
  } catch (e) {
    console.error("[cron/valuation] przebieg przerwany", {
      date: today,
      ms: Date.now() - started,
      error: e instanceof Error ? (e.stack ?? e.message) : String(e),
    });
    return NextResponse.json({ error: "valuation_failed", date: today }, { status: 500 });
  }
}
