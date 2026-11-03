import type { NotificationType } from "@/generated/prisma/enums";
import { scopedTransaction, type ScopedDb, type ScopedTx } from "@/lib/db/scoped";
import type { Mailer } from "@/lib/email/send";
import { D } from "@/lib/money";
import { loadGoals } from "@/lib/portfolio/goal-service";
import { loadPortfolio } from "@/lib/portfolio/ledger/load";
import { dateFromKey, keyFromDate } from "@/lib/portfolio/ledger/service";
import { addDays, dayOfWeek, todayKey, type DateKey } from "@/lib/portfolio/valuation";
import {
  notificationEmail,
  pushMessage,
  renderNotification,
  TYPE_OF,
  type NotificationPayload,
  type WeeklyPayload,
} from "./content";
import { loadPrefs, type Prefs } from "./prefs";
import type { PushSender } from "./push";

/**
 * Powiadomienia (HU-6.1, 6.2): podsumowanie tygodnia, osiągnięty cel, wycena do aktualizacji.
 * Uruchamiane przez cron dla każdego użytkownika; idempotentne, więc kolejne uruchomienie w tym samym
 * okresie niczego nie dubluje. Dostęp do danych wyłącznie przez scopedDb.
 */

export type NotifyDeps = {
  readonly mail: Mailer;
  /** Czy e-mail może wyjść (Resend albo testowa skrzynka); bez tego tylko w aplikacji. */
  readonly emailEnabled: boolean;
  /** null = push wyłączony flagą (brak klucza FCM). */
  readonly push: PushSender | null;
  readonly appUrl: string;
};

export type RunResult = {
  readonly created: NotificationType[];
  readonly emailed: number;
  readonly pushed: number;
  readonly failed: number;
};

/** Stara wycena: przypomnienie najwyżej raz na tyle dni. */
export const STALE_INTERVAL_DAYS = 7;

/**
 * Okres podsumowania: ostatni pełny tydzień (poniedziałek–niedziela) przed bieżącym poniedziałkiem.
 * Zmiana = wartość na koniec niedzieli minus wartość tydzień wcześniej. Ten sam wynik w każdy dzień tygodnia,
 * więc spóźnione uruchomienie crona daje to samo podsumowanie (i ten sam klucz).
 */
export function weekWindow(today: DateKey): { from: DateKey; to: DateKey } {
  const monday = addDays(today, -((dayOfWeek(today) + 6) % 7));
  const to = addDays(monday, -1);
  return { from: addDays(to, -7), to };
}

/**
 * Wpisy z `data.inApp = false` powstają tylko jako ślad idempotencji, gdy typ wyłączono w aplikacji,
 * a włączono np. e-mail. Mają od razu `readAt`, więc licznik nieprzeczytanych ich nie widzi; z listy
 * odsiewamy je w kodzie (filtr JSON w SQL pominąłby też wpisy bez pola `inApp`, bo NULL ≠ false).
 */
const hidden = (data: unknown) =>
  typeof data === "object" && data !== null && (data as Record<string, unknown>).inApp === false;

type Candidate = {
  readonly payload: NotificationPayload;
  /** Klucz okresu w `data.key`. */
  readonly key: string;
};

export async function runNotifications(
  db: ScopedDb,
  userId: string,
  deps: NotifyDeps,
  now: Date = new Date(),
): Promise<RunResult> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, emailVerified: true, locale: true },
  });
  const prefs = await loadPrefs(db);
  const today = todayKey(now);
  const result = { created: [] as NotificationType[], emailed: 0, pushed: 0, failed: 0 };

  const [accountCount, openGoals] = await Promise.all([
    db.financialAccount.count({ where: { archivedAt: null } }),
    db.goal.findMany({ where: { achievedAt: null }, select: { id: true } }),
  ]);
  if (accountCount === 0 && openGoals.length === 0) return result;

  const portfolio = await loadPortfolio(db, today);
  const candidates: Candidate[] = [];

  if (accountCount > 0 && enabledAnywhere(prefs, "WEEKLY_SUMMARY", deps)) {
    const { from, to } = weekWindow(today);
    const key = `weekly:${to}`;
    // Wstępne sprawdzenie bez blokady: nie liczymy dwóch wycen historycznych, gdy podsumowanie już jest.
    if (
      !(await db.notification.findFirst({
        where: { data: { path: ["key"], equals: key } },
        select: { id: true },
      }))
    ) {
      candidates.push({ key, payload: await weeklyPayload(db, from, to) });
    }
  }

  if (openGoals.length > 0) {
    const open = new Set(openGoals.map((g) => g.id));
    for (const g of await loadGoals(db, portfolio, today)) {
      if (open.has(g.id) && g.plan.kind === "achieved") {
        candidates.push({
          key: `goal:${g.id}`,
          payload: { kind: "goal", goalId: g.id, name: g.name, target: g.targetAmount },
        });
      }
    }
  }

  if (portfolio.staleCount > 0) {
    candidates.push({ key: `stale:${today}`, payload: { kind: "stale", count: portfolio.staleCount } });
  }

  for (const c of candidates) {
    const type = TYPE_OF[c.payload.kind];
    const channels = {
      inApp: prefs(type, "IN_APP"),
      // SPEC 4: bez potwierdzonego adresu nie wysyłamy powiadomień e-mail.
      email: prefs(type, "EMAIL") && deps.emailEnabled && user.emailVerified !== null,
      push: prefs(type, "PUSH") && deps.push !== null,
    };
    const created = await claim(db, userId, c, channels, user.locale, now);
    if (!created) continue;
    result.created.push(type);

    if (channels.email) {
      try {
        const sent = await deps.mail(notificationEmail(user.locale, c.payload, user.email, deps.appUrl));
        if (sent.delivered) result.emailed++;
      } catch (err) {
        result.failed++;
        console.error(
          `[powiadomienia] e-mail ${type} nie wyszedł:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
    if (channels.push && deps.push) {
      try {
        const devices = await db.pushDevice.findMany({ select: { token: true } });
        if (devices.length > 0)
          result.pushed += await deps.push(
            devices.map((d) => d.token),
            pushMessage(user.locale, c.payload),
          );
      } catch (err) {
        result.failed++;
        console.error(`[powiadomienia] push ${type} nie wyszedł:`, err instanceof Error ? err.message : err);
      }
    }
  }
  return result;
}

function enabledAnywhere(prefs: Prefs, type: NotificationType, deps: NotifyDeps): boolean {
  return (
    prefs(type, "IN_APP") ||
    (prefs(type, "EMAIL") && deps.emailEnabled) ||
    (prefs(type, "PUSH") && deps.push !== null)
  );
}

/** Wartość netto na koniec dnia: z migawki (Etap 6), a bez niej przeliczona z transakcji. */
async function weeklyPayload(db: ScopedDb, from: DateKey, to: DateKey): Promise<WeeklyPayload> {
  const snapshots = await db.portfolioSnapshot.findMany({
    where: { date: { in: [dateFromKey(from), dateFromKey(to)] } },
    select: { date: true, netWorth: true },
  });
  const byDate = new Map(snapshots.map((s) => [keyFromDate(s.date), s.netWorth.toString()]));
  const valueOn = async (date: DateKey) => byDate.get(date) ?? (await loadPortfolio(db, date)).netWorth;
  const [start, end] = [D(await valueOn(from)), D(await valueOn(to))];
  const change = end.minus(start);
  return {
    kind: "weekly",
    from,
    to,
    netWorth: end.toFixed(),
    change: change.toFixed(),
    percent: start.gt(0) ? change.div(start).toFixed() : null,
  };
}

/**
 * Rezerwuje powiadomienie w transakcji z blokadą doradczą na użytkownika (równoległe uruchomienia crona
 * czekają na siebie), sprawdza, czy w tym okresie już było, i zapisuje wpis. Zwraca false przy duplikacie
 * albo gdy wszystkie kanały typu są wyłączone (cel i tak dostaje `achievedAt`, żeby nie wrócił później).
 */
async function claim(
  db: ScopedDb,
  userId: string,
  c: Candidate,
  channels: { inApp: boolean; email: boolean; push: boolean },
  locale: string,
  now: Date,
): Promise<boolean> {
  return scopedTransaction(db, async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`neto-notify:${userId}`}))`;
    if (await alreadySent(tx, c, now)) return false;
    if (!channels.inApp && !channels.email && !channels.push) return false;
    const { title, body } = renderNotification(locale, c.payload);
    await tx.notification.create({
      data: {
        userId,
        type: TYPE_OF[c.payload.kind],
        title,
        body,
        data: { ...c.payload, key: c.key, inApp: channels.inApp },
        readAt: channels.inApp ? null : now,
      },
    });
    return true;
  });
}

async function alreadySent(tx: ScopedTx, c: Candidate, now: Date): Promise<boolean> {
  switch (c.payload.kind) {
    case "goal": {
      // Raz na cel: znacznik `achievedAt` ustawiamy atomowo; drugi przebieg nic już nie zmieni.
      const { count } = await tx.goal.updateMany({
        where: { id: c.payload.goalId, achievedAt: null },
        data: { achievedAt: now },
      });
      return count === 0;
    }
    case "stale": {
      const since = new Date(now.getTime() - STALE_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
      return (
        (await tx.notification.count({ where: { type: "STALE_VALUATION", createdAt: { gt: since } } })) > 0
      );
    }
    case "weekly":
      return (await tx.notification.count({ where: { data: { path: ["key"], equals: c.key } } })) > 0;
  }
}

// ---------- Ekran powiadomień ----------

export async function listNotifications(db: ScopedDb, limit = 100) {
  const rows = await db.notification.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: { id: true, type: true, title: true, body: true, data: true, readAt: true, createdAt: true },
  });
  return rows.filter((n) => !hidden(n.data));
}

export function unreadCount(db: ScopedDb): Promise<number> {
  return db.notification.count({ where: { readAt: null } });
}

export async function markRead(db: ScopedDb, id: string, now: Date = new Date()): Promise<void> {
  await db.notification.updateMany({ where: { id, readAt: null }, data: { readAt: now } });
}

export async function markAllRead(db: ScopedDb, now: Date = new Date()): Promise<number> {
  const { count } = await db.notification.updateMany({ where: { readAt: null }, data: { readAt: now } });
  return count;
}
