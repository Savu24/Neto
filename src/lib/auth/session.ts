import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { env } from "@/env";
import type { Platform, Session, User } from "@/generated/prisma/client";
import { db } from "@/lib/db/client";
import { generateToken, hashToken } from "./crypto";
import { SESSION_COOKIE_NAME } from "./paths";
import type { RequestMeta } from "./request";

/**
 * Sesje w bazie (wzorzec Lucia): w ciasteczku losowy token, w bazie tylko jego skrót SHA-256.
 * Wygasanie po bezczynności: web 30 dni, iOS 90 dni (SPEC 10); każde użycie przedłuża sesję,
 * gdy minęła połowa okresu. Sesja po haśle przy włączonym 2FA ma twoFactorVerified=false
 * i nie daje dostępu do danych, dopóki użytkownik nie poda kodu.
 */

export const SESSION_COOKIE = SESSION_COOKIE_NAME;
const DAY = 24 * 60 * 60 * 1000;
export const SESSION_TTL: Record<Platform, number> = { web: 30 * DAY, ios: 90 * DAY };

export type SessionUser = Pick<
  User,
  | "id"
  | "email"
  | "name"
  | "emailVerified"
  | "locale"
  | "theme"
  | "privacyMode"
  | "totpEnabledAt"
  | "deletionRequestedAt"
>;
export type SessionResult = { session: Session; user: SessionUser };

const userSelect = {
  id: true,
  email: true,
  name: true,
  emailVerified: true,
  locale: true,
  theme: true,
  privacyMode: true,
  totpEnabledAt: true,
  deletionRequestedAt: true,
} as const;

export async function createSession(
  userId: string,
  meta: RequestMeta,
  opts: { twoFactorVerified: boolean },
  client = db(),
): Promise<{ token: string; session: Session }> {
  const token = generateToken();
  const session = await client.session.create({
    data: {
      sessionToken: hashToken(token),
      userId,
      expires: new Date(Date.now() + SESSION_TTL[meta.platform]),
      twoFactorVerified: opts.twoFactorVerified,
      userAgent: meta.userAgent,
      ipPrefix: meta.ipPrefix,
      platform: meta.platform,
    },
  });
  return { token, session };
}

export async function validateSessionToken(token: string, client = db()): Promise<SessionResult | null> {
  const row = await client.session.findUnique({
    where: { sessionToken: hashToken(token) },
    include: { user: { select: userSelect } },
  });
  if (!row) return null;
  const now = Date.now();
  if (row.expires.getTime() <= now) {
    await client.session.delete({ where: { id: row.id } }).catch(() => {});
    return null;
  }
  const { user, ...session } = row;
  const ttl = SESSION_TTL[session.platform];
  if (row.expires.getTime() - now < ttl / 2 || now - row.lastSeenAt.getTime() > 60 * 60 * 1000) {
    const updated = await client.session.update({
      where: { id: row.id },
      data: { expires: new Date(now + ttl), lastSeenAt: new Date(now) },
    });
    return { session: updated, user };
  }
  return { session, user };
}

export async function invalidateSession(sessionId: string, client = db()) {
  await client.session.deleteMany({ where: { id: sessionId } });
}

export async function invalidateAllSessions(userId: string, opts: { except?: string } = {}, client = db()) {
  await client.session.deleteMany({
    where: { userId, ...(opts.except ? { id: { not: opts.except } } : {}) },
  });
}

export async function setSessionCookie(token: string, platform: Platform) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL[platform] / 1000,
  });
}

export async function deleteSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Bieżąca sesja z ciasteczka (raz na żądanie). Uwzględnia sesje czekające na 2FA. */
export const getSession = cache(async (): Promise<SessionResult | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSessionToken(token);
});

/**
 * Warstwa dostępu do danych: każda strona i akcja z danymi użytkownika woła requireUser().
 * Bez sesji → /login; sesja bez 2FA → /login/2fa.
 */
export async function requireUser(): Promise<SessionResult> {
  const result = await getSession();
  if (!result) redirect("/login");
  if (!result.session.twoFactorVerified) redirect("/login/2fa");
  return result;
}
