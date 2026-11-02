import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, isProtectedPath } from "@/lib/auth/paths";
import { buildCsp, generateNonce } from "@/lib/security/csp";

/**
 * Proxy (dawniej middleware): nagłówek CSP z nonce i szybkie przekierowanie do logowania,
 * gdy brak ciasteczka sesji. To tylko optymistyczna kontrola; właściwą robi requireUser() na serwerze.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isProtectedPath(pathname) && !request.cookies.has(SESSION_COOKIE_NAME)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  const nonce = generateNonce();
  const csp = buildCsp({
    nonce,
    dev: process.env.NODE_ENV === "development",
    botProtection: Boolean(process.env.BOT_PROTECTION_SITE_KEY && process.env.BOT_PROTECTION_SECRET),
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Bez plików statycznych i obrazów; API ma własną autoryzację.
    { source: "/((?!api|_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest).*)" },
  ],
};
