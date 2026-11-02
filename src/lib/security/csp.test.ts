import { describe, expect, it } from "vitest";
import { isProtectedPath, safeNext } from "@/lib/auth/paths";
import { ipPrefix } from "@/lib/auth/request";
import { buildCsp, generateNonce } from "./csp";

describe("CSP", () => {
  it("produkcja: nonce, strict-dynamic, bez unsafe-eval i bez ramek", () => {
    const csp = buildCsp({ nonce: "abc", dev: false, botProtection: false });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("ochrona antybotowa dopuszcza tylko Cloudflare", () => {
    const csp = buildCsp({ nonce: "abc", dev: false, botProtection: true });
    expect(csp).toContain("frame-src https://challenges.cloudflare.com");
  });

  it("nonce jest losowy", () => {
    expect(generateNonce()).not.toBe(generateNonce());
  });
});

describe("ścieżki i przekierowania", () => {
  it("chronione ścieżki", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/settings/security")).toBe(true);
    expect(isProtectedPath("/dashboardx")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
  });

  it("safeNext blokuje open redirect", () => {
    expect(safeNext("/assets?x=1")).toBe("/assets?x=1");
    expect(safeNext("//evil.example")).toBe("/dashboard");
    expect(safeNext("https://evil.example")).toBe("/dashboard");
    expect(safeNext("/\\evil.example")).toBe("/dashboard");
    expect(safeNext("/login")).toBe("/dashboard");
    expect(safeNext(undefined)).toBe("/dashboard");
  });

  it("skracanie IP", () => {
    expect(ipPrefix("203.0.113.77")).toBe("203.0.113.0");
    expect(ipPrefix("2001:db8:85a3:8d3:1319:8a2e:370:7348")).toBe("2001:db8:85a3::");
    expect(ipPrefix("::ffff:198.51.100.9")).toBe("198.51.100.0");
    expect(ipPrefix(null)).toBeNull();
  });
});
