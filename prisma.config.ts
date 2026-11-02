import { defineConfig } from "prisma/config";

// Lokalne zmienne z .env.local (baza lokalna). Na Vercelu/CI zmienne przychodzą ze środowiska.
try {
  process.loadEnvFile(".env.local");
} catch {
  // brak pliku jest w porządku
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // `prisma generate` nie potrzebuje bazy; migracje i seed wymagają DATABASE_URL.
    url: process.env.DATABASE_URL ?? "postgresql://invalid:invalid@localhost:1/invalid",
  },
});
