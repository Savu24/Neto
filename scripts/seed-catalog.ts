/**
 * Katalog wspólny instrumentów (src/lib/portfolio/catalog): npx tsx scripts/seed-catalog.ts
 * Bazę wskazuje DATABASE_URL (lokalnie z .env.local). Idempotentne, niczego nie usuwa.
 * Na produkcji uruchamia właściciel (jednorazowo po wdrożeniu i po zmianie listy).
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedCatalog } from "../src/lib/portfolio/catalog/seed";

export async function runSeedCatalog(url: string) {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    return await seedCatalog(db);
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1]?.endsWith("seed-catalog.ts")) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // brak pliku
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Brak DATABASE_URL");
  runSeedCatalog(url).then((n) => console.log(`Katalog: ${n} instrumentów.`));
}
