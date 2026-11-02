import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { generateToken, hashToken } from "./crypto";

export type TokenPurpose = "verify-email" | "reset-password";

export const TOKEN_TTL: Record<TokenPurpose, number> = {
  "verify-email": 24 * 60 * 60 * 1000,
  "reset-password": 60 * 60 * 1000,
};

/** Jednorazowy token do linku w e-mailu. W bazie tylko skrót; poprzednie tokeny tego samego celu są unieważniane. */
export async function createToken(db: PrismaClient, purpose: TokenPurpose, userId: string, now = new Date()) {
  const identifier = `${purpose}:${userId}`;
  const token = generateToken();
  await db.$transaction([
    db.verificationToken.deleteMany({ where: { identifier } }),
    db.verificationToken.create({
      data: { identifier, token: hashToken(token), expires: new Date(now.getTime() + TOKEN_TTL[purpose]) },
    }),
  ]);
  return token;
}

/** Zużywa token: zwraca userId albo null (nieznany, wygasły, innego celu). */
export async function consumeToken(db: PrismaClient, purpose: TokenPurpose, token: string, now = new Date()) {
  const row = await db.verificationToken.findUnique({ where: { token: hashToken(token) } });
  if (!row || !row.identifier.startsWith(`${purpose}:`)) return null;
  await db.verificationToken.delete({ where: { token: row.token } });
  if (row.expires <= now) return null;
  return row.identifier.slice(purpose.length + 1);
}
