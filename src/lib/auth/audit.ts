import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import type { RequestMeta } from "./request";

export type AuditEvent =
  | "register"
  | "login"
  | "login_failed"
  | "login_2fa_failed"
  | "logout"
  | "logout_all"
  | "session_revoked"
  | "password_changed"
  | "password_reset_requested"
  | "password_reset"
  | "email_verified"
  | "totp_enabled"
  | "totp_disabled"
  | "backup_codes_regenerated"
  | "backup_code_used"
  | "google_linked"
  | "account_deletion_requested"
  | "account_deletion_cancelled"
  | "data_exported";

/** Dziennik zdarzeń bezpieczeństwa. Bez haseł, kodów, tokenów i kwot. */
export async function audit(
  db: PrismaClient,
  event: AuditEvent,
  opts: { userId?: string | null; meta?: RequestMeta; data?: Record<string, string | number | boolean> } = {},
) {
  await db.auditLog.create({
    data: {
      userId: opts.userId ?? null,
      event,
      ipPrefix: opts.meta?.ipPrefix ?? null,
      userAgent: opts.meta?.userAgent ?? null,
      meta: opts.data,
    },
  });
}
