import { NextResponse } from "next/server";
import { purgeDeletedAccounts } from "@/lib/auth/service";
import { db } from "@/lib/db/client";
import { rejectCron } from "../auth";

/** Codziennie (vercel.json): twarde usunięcie kont po 14 dniach karencji. Vercel wysyła Bearer CRON_SECRET. */
export async function GET(request: Request) {
  const rejected = rejectCron(request);
  if (rejected) return rejected;
  const deleted = await purgeDeletedAccounts({ db: db() });
  return NextResponse.json({ deleted });
}
