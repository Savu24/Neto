import "server-only";
import { env, features } from "@/env";
import { emailAvailable, sendEmail } from "@/lib/email/send";
import { pushNotImplemented } from "./push";
import type { NotifyDeps } from "./service";

/** Zależności serwisu powiadomień w aplikacji (w testach podstawiamy własne). */
export function notifyDeps(): NotifyDeps {
  return {
    mail: sendEmail,
    emailEnabled: emailAvailable(),
    push: features().push ? pushNotImplemented : null,
    appUrl: env().APP_URL,
  };
}
