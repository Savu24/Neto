import "server-only";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { env, features } from "@/env";

/**
 * Wysyłka e-maili transakcyjnych. Dostawca: Resend (REST API, klucz EMAIL_PROVIDER_KEY, nadawca EMAIL_FROM).
 * Bez klucza: e-mail nie wychodzi (funkcja wyłączona), a lokalnie/w e2e może trafić do MAIL_OUTBOX_DIR.
 */

export type Email = { to: string; subject: string; text: string };
export type Mailer = (email: Email) => Promise<{ delivered: boolean }>;

export const sendEmail: Mailer = async (email) => {
  const e = env();
  if (features().email) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${e.EMAIL_PROVIDER_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: e.EMAIL_FROM, to: [email.to], subject: email.subject, text: email.text }),
    });
    if (!res.ok) throw new Error(`Wysyłka e-maila nie powiodła się (HTTP ${res.status})`);
    return { delivered: true };
  }
  if (e.MAIL_OUTBOX_DIR) {
    mkdirSync(e.MAIL_OUTBOX_DIR, { recursive: true });
    const safe = email.to.replace(/[^a-z0-9@._-]/gi, "_");
    writeFileSync(path.join(e.MAIL_OUTBOX_DIR, `${Date.now()}-${safe}.json`), JSON.stringify(email, null, 2));
    return { delivered: true };
  }
  if (e.NODE_ENV === "development") console.info(`[e-mail wyłączony] do ${email.to}: ${email.subject}`);
  return { delivered: false };
};

/** Czy użytkownik może dostać e-mail (reset hasła, weryfikacja)? Używane do ukrywania tych opcji w UI. */
export function emailAvailable(): boolean {
  return features().email || Boolean(env().MAIL_OUTBOX_DIR);
}
