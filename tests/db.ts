import { inject } from "vitest";
import { createPrismaClient } from "@/lib/db/client";
import type { PrismaClient } from "@/generated/prisma/client";

/** Klient bazy testowej (tylko w *.db.test.ts). */
export function testDb(): PrismaClient {
  return createPrismaClient(inject("databaseUrl"));
}

/** Czyści wszystkie tabele aplikacji między testami. */
export async function resetDb(client: PrismaClient) {
  const tables = await client.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await client.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
