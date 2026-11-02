import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/env";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Surowy klient bazy. W kodzie aplikacji używaj `scopedDb(userId)` z `./scoped`;
 * surowy klient tylko w zadaniach systemowych (cron, logowanie) i w testach.
 */
export function createPrismaClient(connectionString: string) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

const globalForPrisma = globalThis as unknown as { netoPrisma?: PrismaClient };

export function db(): PrismaClient {
  if (!globalForPrisma.netoPrisma) {
    const url = env().DATABASE_URL;
    if (!url) throw new Error("Brak DATABASE_URL. Lokalnie: npm run db:start (CLAUDE.md, „Baza”).");
    globalForPrisma.netoPrisma = createPrismaClient(url);
  }
  return globalForPrisma.netoPrisma;
}
