import { NextResponse } from "next/server";
import { authDeps } from "@/lib/auth/deps";
import { finishGoogleLogin, googleClient, savePendingGoogle } from "@/lib/auth/google";
import { requestMeta } from "@/lib/auth/request";
import { loginWithGoogle, notifyLogin } from "@/lib/auth/service";
import { createSession, setSessionCookie } from "@/lib/auth/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));
  const client = googleClient();
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!client || !code || !state) return to("/login?notice=google-failed");

  const profile = await finishGoogleLogin(client, code, state);
  if (!profile) return to("/login?notice=google-failed");

  const deps = authDeps();
  const meta = await requestMeta();
  const res = await loginWithGoogle(deps, profile, meta);
  if (!res.ok) {
    if (res.error === "google_link_requires_password") {
      await savePendingGoogle(profile);
      return to("/login/google-link");
    }
    return to("/login?notice=google-failed");
  }

  const { token, session } = await createSession(res.userId, meta, {
    twoFactorVerified: !res.needsTwoFactor,
  });
  await setSessionCookie(token, meta.platform);
  if (res.needsTwoFactor) return to("/login/2fa");
  await notifyLogin(deps, res.userId, session.id, meta);
  return to(res.deletionCancelled ? "/dashboard?notice=deletion-cancelled" : "/dashboard");
}
