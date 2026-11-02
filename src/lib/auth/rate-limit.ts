import "server-only";
import { createHash } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Limity prób w bazie (działa na wielu instancjach serverless). Stałe okno czasowe.
 * Klucze nie zawierają danych osobowych wprost: e-mail i IP są skracane skrótem.
 */

export type Limit = { limit: number; windowSec: number };

export const LIMITS = {
  loginEmail: { limit: 5, windowSec: 15 * 60 },
  loginIp: { limit: 20, windowSec: 15 * 60 },
  twoFactor: { limit: 5, windowSec: 15 * 60 },
  register: { limit: 5, windowSec: 60 * 60 },
  reset: { limit: 3, windowSec: 60 * 60 },
  verifyEmail: { limit: 3, windowSec: 60 * 60 },
} satisfies Record<string, Limit>;

export function rateKey(kind: keyof typeof LIMITS, subject: string): string {
  return `${kind}:${createHash("sha256").update(subject).digest("hex").slice(0, 32)}`;
}

export type RateResult = { ok: true } | { ok: false; retryAfterSec: number };

/** Zwiększa licznik i mówi, czy limit nie został przekroczony. Atomowo (jedno zapytanie SQL). */
export async function consume(db: PrismaClient, key: string, { limit, windowSec }: Limit, now = new Date()) {
  const windowStart = new Date(now.getTime() - windowSec * 1000);
  const rows = await db.$queryRaw<{ count: number; windowStart: Date }[]>`
    INSERT INTO "RateLimit" ("key", "windowStart", "count") VALUES (${key}, ${now}, 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" < ${windowStart} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" < ${windowStart} THEN ${now} ELSE "RateLimit"."windowStart" END
    RETURNING "count", "windowStart"`;
  const row = rows[0];
  if (row.count <= limit) return { ok: true } as RateResult;
  const retryAfterSec = Math.max(
    1,
    Math.ceil((row.windowStart.getTime() + windowSec * 1000 - now.getTime()) / 1000),
  );
  return { ok: false, retryAfterSec } as RateResult;
}

/** Po udanym logowaniu licznik dla konta wraca do zera. */
export async function resetLimit(db: PrismaClient, key: string) {
  await db.rateLimit.deleteMany({ where: { key } });
}
