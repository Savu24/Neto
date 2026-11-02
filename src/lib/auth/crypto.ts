import { hash, verify } from "@node-rs/argon2";
import { createHash, randomBytes, randomInt } from "node:crypto";

// argon2id z parametrami minimalnymi OWASP (19 MiB, 2 iteracje, 1 wątek).
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 256;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON);
}

export async function verifyPassword(hashed: string, password: string): Promise<boolean> {
  try {
    return await verify(hashed, password);
  } catch {
    return false;
  }
}

/** Losowy token do ciasteczka lub linku (256 bitów). W bazie trzymamy tylko jego skrót. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** Kod zapasowy 2FA w formacie xxxx-xxxx (ok. 39 bitów; chroniony limitem prób). */
export function generateBackupCode(): string {
  const pick = () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  const part = () => Array.from({ length: 4 }, pick).join("");
  return `${part()}-${part()}`;
}

export function normalizeBackupCode(code: string): string {
  return code.trim().toLowerCase().replace(/\s/g, "");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
