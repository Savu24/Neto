import "server-only";
import { headers } from "next/headers";
import type { Platform } from "@/generated/prisma/enums";

export type RequestMeta = {
  ip: string | null;
  ipPrefix: string | null;
  userAgent: string | null;
  platform: Platform;
};

/** Skraca IP: IPv4 bez ostatniego oktetu, IPv6 do /48. Pełnego IP nie zapisujemy (SPEC 10). */
export function ipPrefix(ip: string | null): string | null {
  if (!ip) return null;
  if (ip.includes(".") && !ip.includes(":")) return ip.split(".").slice(0, 3).join(".") + ".0";
  const v4mapped = ip.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (v4mapped) return ipPrefix(v4mapped[1]);
  return ip.split(":").slice(0, 3).join(":") + "::";
}

// Aplikacja iOS dopisuje do User-Agenta znacznik (Etap 11, mobile/capacitor.config.ts).
export const IOS_APP_UA_MARKER = "NetoApp-iOS";

export async function requestMeta(): Promise<RequestMeta> {
  const h = await headers();
  // Vercel ustawia x-forwarded-for; pierwszy adres to klient.
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const userAgent = h.get("user-agent")?.slice(0, 400) ?? null;
  return {
    ip,
    ipPrefix: ipPrefix(ip),
    userAgent,
    platform: userAgent?.includes(IOS_APP_UA_MARKER) ? "ios" : "web",
  };
}
