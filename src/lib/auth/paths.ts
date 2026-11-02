// Bez importów serwerowych: używane także w proxy.ts.

export const SESSION_COOKIE_NAME = "neto_session";

const PROTECTED = ["/dashboard", "/assets", "/goals", "/settings", "/add", "/notifications"];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Bezpieczny adres powrotu po logowaniu: tylko ścieżka w obrębie aplikacji (bez open redirect). */
export function safeNext(next: unknown, fallback = "/dashboard"): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return isProtectedPath(next.split("?")[0]) ? next : fallback;
}
