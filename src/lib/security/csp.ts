/**
 * Content-Security-Policy z nonce na każde żądanie (SPEC 10). Skrypty tylko z nonce ('strict-dynamic'),
 * style z 'unsafe-inline' (atrybuty style w wykresach SVG; wstrzyknięcie stylu nie wykona kodu).
 * Etap 11: przy powłoce Capacitora sprawdzić, czy mostek natywny mieści się w tej polityce.
 */
export function buildCsp(opts: { nonce: string; dev: boolean; botProtection: boolean }): string {
  const turnstile = opts.botProtection ? " https://challenges.cloudflare.com" : "";
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${opts.nonce}' 'strict-dynamic'${opts.dev ? " 'unsafe-eval'" : ""}${turnstile}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${opts.dev ? " ws:" : ""}`,
    `frame-src ${opts.botProtection ? "https://challenges.cloudflare.com" : "'none'"}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(opts.dev ? [] : ["upgrade-insecure-requests"]),
  ];
  return directives.join("; ");
}

export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
