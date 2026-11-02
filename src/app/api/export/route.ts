import { NextResponse } from "next/server";
import { audit } from "@/lib/auth/audit";
import { requestMeta } from "@/lib/auth/request";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { buildUserExport } from "@/lib/export/user-data";
import { warsawDateKey } from "@/lib/format";

export async function GET() {
  const current = await getSession();
  if (!current?.session.twoFactorVerified) return new NextResponse("Brak dostępu", { status: 401 });
  const zip = await buildUserExport(db(), current.user.id);
  await audit(db(), "data_exported", { userId: current.user.id, meta: await requestMeta() });
  return new NextResponse(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="neto-dane-${warsawDateKey()}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
