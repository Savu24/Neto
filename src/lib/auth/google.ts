import "server-only";
import { Google, decodeIdToken, generateCodeVerifier, generateState } from "arctic";
import { cookies } from "next/headers";
import { env, features } from "@/env";
import { decryptField, encryptField } from "@/lib/crypto/fields";
import type { GoogleProfile } from "./service";

/**
 * Logowanie Google (OAuth 2.0 + PKCE, biblioteka arctic). Bez AUTH_GOOGLE_ID/SECRET wyłączone.
 * Token ID przychodzi bezpośrednio z Google przy wymianie kodu (TLS), więc dekodujemy go bez osobnej weryfikacji podpisu.
 */

const STATE_COOKIE = "neto_google_state";
const VERIFIER_COOKIE = "neto_google_verifier";
const PENDING_COOKIE = "neto_google_pending";
const TEN_MIN = 10 * 60;

export function googleClient(): Google | null {
  if (!features().googleLogin) return null;
  const e = env();
  return new Google(e.AUTH_GOOGLE_ID!, e.AUTH_GOOGLE_SECRET!, `${e.APP_URL}/api/auth/google/callback`);
}

const cookieOpts = () => ({
  httpOnly: true,
  secure: env().NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: TEN_MIN,
});

export async function startGoogleLogin(client: Google): Promise<URL> {
  const state = generateState();
  const verifier = generateCodeVerifier();
  const url = client.createAuthorizationURL(state, verifier, ["openid", "email", "profile"]);
  const store = await cookies();
  store.set(STATE_COOKIE, state, cookieOpts());
  store.set(VERIFIER_COOKIE, verifier, cookieOpts());
  return url;
}

export async function finishGoogleLogin(
  client: Google,
  code: string,
  state: string,
): Promise<GoogleProfile | null> {
  const store = await cookies();
  const expected = store.get(STATE_COOKIE)?.value;
  const verifier = store.get(VERIFIER_COOKIE)?.value;
  store.delete(STATE_COOKIE);
  store.delete(VERIFIER_COOKIE);
  if (!expected || !verifier || expected !== state) return null;
  try {
    const tokens = await client.validateAuthorizationCode(code, verifier);
    const claims = decodeIdToken(tokens.idToken()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
    };
    if (!claims.sub || !claims.email) return null;
    return {
      sub: claims.sub,
      email: claims.email,
      emailVerified: claims.email_verified === true,
      name: claims.name,
    };
  } catch {
    return null;
  }
}

/** Profil Google czekający na potwierdzenie hasłem (zaszyfrowany, 10 minut). */
export async function savePendingGoogle(profile: GoogleProfile) {
  (await cookies()).set(PENDING_COOKIE, encryptField(JSON.stringify(profile)), cookieOpts());
}

export async function readPendingGoogle(): Promise<GoogleProfile | null> {
  const raw = (await cookies()).get(PENDING_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(decryptField(raw)) as GoogleProfile;
  } catch {
    return null;
  }
}

export async function clearPendingGoogle() {
  (await cookies()).delete(PENDING_COOKIE);
}
