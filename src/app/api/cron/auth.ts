import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env, features } from "@/env";

/**
 * Wspólne sprawdzenie wywołań crona: bez `CRON_SECRET` endpointy są wyłączone (404),
 * a Vercel wysyła nagłówek `Authorization: Bearer CRON_SECRET`. Zwraca odpowiedź odmowy albo `null`.
 */
export function rejectCron(request: Request): NextResponse | null {
  if (!features().cron) return new NextResponse("Cron wyłączony", { status: 404 });
  const expected = Buffer.from(`Bearer ${env().CRON_SECRET}`);
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) {
    return new NextResponse("Brak dostępu", { status: 401 });
  }
  return null;
}
