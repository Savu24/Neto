import { NextResponse } from "next/server";

// Sprawdzenie, czy aplikacja żyje (monitoring, testy e2e). Bez danych użytkowników.
export function GET() {
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
