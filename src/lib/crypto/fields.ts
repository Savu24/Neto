import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "@/env";

/**
 * Szyfrowanie pól wrażliwych (`*Enc` w schemacie): AES-256-GCM.
 * Format: `v1:<iv>:<tag>:<szyfrogram>` (base64url). Klucz: FIELD_ENCRYPTION_KEY (32 bajty w base64).
 * Bez klucza: w dev i testach klucz testowy z ostrzeżeniem; na produkcji błąd (SPEC sekcja 8).
 */

const VERSION = "v1";
// Klucz wyłącznie do pracy lokalnej. Dane zaszyfrowane nim nie są chronione.
const DEV_KEY = Buffer.alloc(32, "neto-dev-only-key");
let warned = false;

export function parseKey(raw: string | undefined, nodeEnv: string): Buffer {
  if (!raw) {
    if (nodeEnv === "production") throw new Error("Brak FIELD_ENCRYPTION_KEY na produkcji");
    if (!warned && nodeEnv !== "test") {
      console.warn("FIELD_ENCRYPTION_KEY nie jest ustawiony: używam klucza deweloperskiego.");
      warned = true;
    }
    return DEV_KEY;
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("FIELD_ENCRYPTION_KEY musi mieć 32 bajty (base64)");
  return key;
}

function key(): Buffer {
  const e = env();
  return parseKey(e.FIELD_ENCRYPTION_KEY, e.NODE_ENV);
}

export function encryptField(plain: string, k: Buffer = key()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, data].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(":");
}

export function decryptField(payload: string, k: Buffer = key()): string {
  const [version, iv, tag, data] = payload.split(":");
  if (version !== VERSION || !iv || !tag || data === undefined) {
    throw new Error("Nieznany format zaszyfrowanego pola");
  }
  const decipher = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

export function encryptOptional(plain: string | null | undefined): string | null {
  return plain ? encryptField(plain) : null;
}

export function decryptOptional(payload: string | null | undefined): string | null {
  return payload ? decryptField(payload) : null;
}
