import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env, features } from "@/env";
import { purgeDeletedAccounts } from "@/lib/auth/service";
import { db } from "@/lib/db/client";

/** Codziennie (vercel.json): twarde usunięcie kont po 14 dniach karencji. Vercel wysyła Bearer CRON_SECRET. */
export async function GET(request: Request) {
  if (!features().cron) return new NextResponse("Cron wyłączony", { status: 404 });
  const expected = Buffer.from(`Bearer ${env().CRON_SECRET}`);
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) {
    return new NextResponse("Brak dostępu", { status: 401 });
  }
  const deleted = await purgeDeletedAccounts({ db: db() });
  return NextResponse.json({ deleted });
}
