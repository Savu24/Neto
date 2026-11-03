import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env, features } from "@/env";
import { db } from "@/lib/db/client";
import { runNotificationsForAll } from "@/lib/notifications/cron";
import { notifyDeps } from "@/lib/notifications/deps";

// Przebieg dla wszystkich użytkowników partiami; przy kilku kontach trwa sekundy, limit z zapasem.
export const maxDuration = 300;

/**
 * Codziennie (vercel.json): podsumowanie tygodnia (w tygodniu raz, za ostatni pełny tydzień), osiągnięte cele
 * i przypomnienie o starych wycenach (najwyżej raz na 7 dni). Vercel wysyła Bearer CRON_SECRET.
 */
export async function GET(request: Request) {
  if (!features().cron) return new NextResponse("Cron wyłączony", { status: 404 });
  const expected = Buffer.from(`Bearer ${env().CRON_SECRET}`);
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) {
    return new NextResponse("Brak dostępu", { status: 401 });
  }
  const summary = await runNotificationsForAll(db(), notifyDeps());
  return NextResponse.json(summary);
}
