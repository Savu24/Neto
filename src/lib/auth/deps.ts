import "server-only";
import { env } from "@/env";
import { db } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/send";
import { pwnedChecker } from "./external";
import type { Deps } from "./service";

/** Zależności serwisu konta w aplikacji (w testach podstawiamy własne). */
export function authDeps(): Deps {
  return { db: db(), mail: sendEmail, appUrl: env().APP_URL, isPwned: pwnedChecker() };
}
