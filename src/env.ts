import "server-only";
import { z } from "zod";

/**
 * Jedyne miejsce, w którym czytamy zmienne środowiskowe serwera (SPEC sekcja 15).
 * Funkcje zależne od kluczy włączają się same, gdy klucz jest ustawiony; bez klucza
 * funkcja jest wyłączona, a aplikacja działa dalej. Nie dodawaj osobnych przełączników „ENABLE_*”.
 */

const optional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default("http://localhost:3000"),

  // Wymagane od Etapu 3 (baza) i Etapu 4 (logowanie). Do tego czasu opcjonalne.
  DATABASE_URL: optional,
  AUTH_SECRET: optional,
  FIELD_ENCRYPTION_KEY: optional,

  AUTH_GOOGLE_ID: optional,
  AUTH_GOOGLE_SECRET: optional,
  EMAIL_PROVIDER_KEY: optional,
  EMAIL_FROM: optional,
  PRICING_PROVIDER: optional,
  PRICING_API_KEY: optional,
  FCM_SERVICE_ACCOUNT: optional,
  CRON_SECRET: optional,
  SENTRY_DSN: optional,
  BOT_PROTECTION_SITE_KEY: optional,
  BOT_PROTECTION_SECRET: optional,
  PWNED_PASSWORDS_CHECK: optional,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    const fields = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Nieprawidłowe zmienne środowiskowe: ${fields}`);
  }
  return result.data;
}

/** Flagi funkcji wyliczane z obecności kluczy. */
export function featureFlags(env: ServerEnv) {
  return {
    googleLogin: Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET),
    email: Boolean(env.EMAIL_PROVIDER_KEY && env.EMAIL_FROM),
    marketPricing: Boolean(env.PRICING_PROVIDER && env.PRICING_API_KEY),
    push: Boolean(env.FCM_SERVICE_ACCOUNT),
    cron: Boolean(env.CRON_SECRET),
    sentry: Boolean(env.SENTRY_DSN),
    botProtection: Boolean(env.BOT_PROTECTION_SITE_KEY && env.BOT_PROTECTION_SECRET),
    pwnedPasswords: env.PWNED_PASSWORDS_CHECK === "true",
  } as const;
}

export type FeatureFlags = ReturnType<typeof featureFlags>;

let cached: ServerEnv | undefined;

/** Leniwie: walidacja przy pierwszym użyciu, nie przy imporcie (next build działa bez sekretów). */
export function env(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}

export function features(): FeatureFlags {
  return featureFlags(env());
}
