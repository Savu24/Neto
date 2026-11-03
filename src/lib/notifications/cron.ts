import type { PrismaClient } from "@/generated/prisma/client";
import type { NotificationType } from "@/generated/prisma/enums";
import { scopedDb } from "@/lib/db/scoped";
import { runNotifications, type NotifyDeps } from "./service";

/**
 * Przebieg dla wszystkich użytkowników (cron). Surowy klient służy tylko do listy identyfikatorów;
 * dane każdego użytkownika czyta i zapisuje serwis przez scopedDb. Błąd jednego użytkownika nie przerywa reszty.
 */

export const BATCH_SIZE = 50;
const PARALLEL = 5;

export type CronSummary = {
  users: number;
  created: Partial<Record<NotificationType, number>>;
  emailed: number;
  pushed: number;
  failed: number;
};

export async function runNotificationsForAll(
  base: PrismaClient,
  deps: NotifyDeps,
  now: Date = new Date(),
  batchSize = BATCH_SIZE,
): Promise<CronSummary> {
  const summary: CronSummary = { users: 0, created: {}, emailed: 0, pushed: 0, failed: 0 };
  let cursor: string | undefined;
  for (;;) {
    const batch = await base.user.findMany({
      where: { deletionRequestedAt: null },
      select: { id: true },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (batch.length === 0) break;
    for (let i = 0; i < batch.length; i += PARALLEL) {
      const results = await Promise.allSettled(
        batch.slice(i, i + PARALLEL).map((u) => runNotifications(scopedDb(base, u.id), u.id, deps, now)),
      );
      for (const r of results) {
        summary.users++;
        if (r.status === "rejected") {
          summary.failed++;
          console.error(
            "[powiadomienia] przebieg użytkownika nie powiódł się:",
            r.reason instanceof Error ? r.reason.message : r.reason,
          );
          continue;
        }
        for (const type of r.value.created) summary.created[type] = (summary.created[type] ?? 0) + 1;
        summary.emailed += r.value.emailed;
        summary.pushed += r.value.pushed;
        summary.failed += r.value.failed;
      }
    }
    cursor = batch[batch.length - 1].id;
    if (batch.length < batchSize) break;
  }
  return summary;
}
