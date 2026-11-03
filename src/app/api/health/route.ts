import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";

// Sprawdzenie, czy aplikacja żyje (monitoring, testy e2e). Bez danych użytkowników.
// `?db=1`: dodatkowo czas trzech zapytań `SELECT 1` w ms (diagnoza odległości funkcji od bazy).
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (new URL(request.url).searchParams.get("db") !== "1")
    return NextResponse.json({ ok: true }, { headers });
  const timings: number[] = [];
  try {
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      await db().$queryRaw`SELECT 1`;
      timings.push(Math.round(performance.now() - start));
    }
  } catch {
    return NextResponse.json({ ok: false, db: "error" }, { status: 503, headers });
  }
  return NextResponse.json({ ok: true, dbMs: timings }, { headers });
}
