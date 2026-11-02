import "server-only";
import { createHash } from "node:crypto";
import { env, features } from "@/env";

/**
 * Sprawdzenie hasła w bazie wycieków (Have I Been Pwned, k-anonimowość: wysyłamy tylko
 * 5 pierwszych znaków skrótu SHA-1). Włączane PWNED_PASSWORDS_CHECK=true. Błąd sieci = nie blokujemy.
 */
export async function isPwnedPassword(password: string, fetcher: typeof fetch = fetch): Promise<boolean> {
  const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const res = await fetcher(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const body = await res.text();
    return body.split("\n").some((line) => {
      const [hashSuffix, count] = line.trim().split(":");
      return hashSuffix === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}

export function pwnedChecker() {
  return features().pwnedPasswords ? (p: string) => isPwnedPassword(p) : null;
}

/** Ochrona antybotowa przy rejestracji (Cloudflare Turnstile). Bez kluczy: wyłączona. */
export async function verifyBotToken(token: string | null, ip: string | null, fetcher: typeof fetch = fetch) {
  if (!features().botProtection) return true;
  if (!token) return false;
  const body = new URLSearchParams({ secret: env().BOT_PROTECTION_SECRET!, response: token });
  if (ip) body.set("remoteip", ip);
  try {
    const res = await fetcher("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
