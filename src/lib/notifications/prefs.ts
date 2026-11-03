import type { NotificationChannel, NotificationType } from "@/generated/prisma/enums";
import { scopedTransaction, type ScopedDb } from "@/lib/db/scoped";

/**
 * Preferencje powiadomień (HU-6.3): każdy typ osobno dla każdego kanału. Brak wpisu = włączone.
 * Bezpieczeństwo nie ma przełączników (e-mail zawsze, SPEC 9), więc nie ma go w `CONFIGURABLE_TYPES`.
 */

export const CONFIGURABLE_TYPES = [
  "WEEKLY_SUMMARY",
  "GOAL_ACHIEVED",
  "STALE_VALUATION",
] as const satisfies readonly NotificationType[];
export type ConfigurableType = (typeof CONFIGURABLE_TYPES)[number];

/** Kanały na ekranie preferencji. PUSH dojdzie z aplikacją na iPhone'a (dziś wyłączony flagą). */
export const EDITABLE_CHANNELS = ["IN_APP", "EMAIL"] as const satisfies readonly NotificationChannel[];
export type EditableChannel = (typeof EDITABLE_CHANNELS)[number];

export type PrefRow = { type: NotificationType; channel: NotificationChannel; enabled: boolean };
export type Prefs = (type: NotificationType, channel: NotificationChannel) => boolean;

export function resolvePrefs(rows: readonly PrefRow[]): Prefs {
  const map = new Map(rows.map((r) => [`${r.type}:${r.channel}`, r.enabled]));
  return (type, channel) => map.get(`${type}:${channel}`) ?? true;
}

export async function loadPrefs(db: ScopedDb): Promise<Prefs> {
  return resolvePrefs(
    await db.notificationPref.findMany({ select: { type: true, channel: true, enabled: true } }),
  );
}

/** Nazwa pola formularza dla pary typ–kanał. */
export const prefField = (type: ConfigurableType, channel: EditableChannel) => `${type}:${channel}`;

/** Formularz z polami wyboru: zaznaczone pole = włączone, brak pola = wyłączone. */
export function prefsFromForm(fd: FormData, opts: { emailEditable: boolean; current: Prefs }): PrefRow[] {
  return CONFIGURABLE_TYPES.flatMap((type) =>
    EDITABLE_CHANNELS.map((channel) => ({
      type,
      channel,
      // Bez potwierdzonego adresu pola e-mail są nieaktywne i nie przychodzą: zostawiamy zapisany stan.
      enabled:
        channel === "EMAIL" && !opts.emailEditable
          ? opts.current(type, channel)
          : fd.get(prefField(type, channel)) === "on",
    })),
  );
}

export async function savePrefs(db: ScopedDb, userId: string, rows: readonly PrefRow[]): Promise<void> {
  await scopedTransaction(db, async (tx) => {
    for (const r of rows) {
      await tx.notificationPref.upsert({
        where: { userId_type_channel: { userId, type: r.type, channel: r.channel } },
        create: { userId, type: r.type, channel: r.channel, enabled: r.enabled },
        update: { enabled: r.enabled },
      });
    }
  });
}
