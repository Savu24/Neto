import type { NotificationType } from "@/generated/prisma/enums";
import { isLocale, type Locale } from "@/i18n/config";
import { createTranslator } from "@/i18n/translate";
import type { Email } from "@/lib/email/send";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";

/**
 * Treści powiadomień (SPEC sekcja 9) w języku odbiorcy. Czyste funkcje: w bazie trzymamy dane
 * (`Notification.data`), a tekst składamy przy wyświetlaniu, więc zmiana języka zmienia też stare wpisy.
 * Push nigdy nie zawiera kwot ani nazw instrumentów.
 */

export type WeeklyPayload = {
  readonly kind: "weekly";
  /** Dzień, od którego liczymy zmianę (YYYY-MM-DD). */
  readonly from: string;
  readonly to: string;
  readonly netWorth: string;
  readonly change: string;
  /** Zmiana jako ułamek; null, gdy wartość początkowa nie była dodatnia. */
  readonly percent: string | null;
};
export type GoalPayload = {
  readonly kind: "goal";
  readonly goalId: string;
  readonly name: string;
  readonly target: string;
};
export type StalePayload = { readonly kind: "stale"; readonly count: number };
export type NotificationPayload = WeeklyPayload | GoalPayload | StalePayload;

export const TYPE_OF: Record<NotificationPayload["kind"], NotificationType> = {
  weekly: "WEEKLY_SUMMARY",
  goal: "GOAL_ACHIEVED",
  stale: "STALE_VALUATION",
};

const localeOf = (value: string): Locale => (isLocale(value) ? value : "pl");
const isStr = (v: unknown): v is string => typeof v === "string";

/** Odczyt `Notification.data` (Json) z powrotem do typu; null przy wpisie w innym kształcie. */
export function parsePayload(data: unknown): NotificationPayload | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  switch (d.kind) {
    case "weekly":
      return isStr(d.from) && isStr(d.to) && isStr(d.netWorth) && isStr(d.change)
        ? {
            kind: "weekly",
            from: d.from,
            to: d.to,
            netWorth: d.netWorth,
            change: d.change,
            percent: isStr(d.percent) ? d.percent : null,
          }
        : null;
    case "goal":
      return isStr(d.goalId) && isStr(d.name) && isStr(d.target)
        ? { kind: "goal", goalId: d.goalId, name: d.name, target: d.target }
        : null;
    case "stale":
      return typeof d.count === "number" ? { kind: "stale", count: d.count } : null;
    default:
      return null;
  }
}

function weeklyFigures(p: WeeklyPayload, locale: Locale) {
  return {
    netWorth: formatMoney(p.netWorth, "PLN", locale),
    change: formatMoney(p.change, "PLN", locale, { signed: true }),
    percent: p.percent === null ? null : formatPercent(p.percent, locale, { signed: true }),
    from: formatDate(p.from, locale),
    to: formatDate(p.to, locale),
  };
}

/** Tytuł i treść do listy w aplikacji. */
export function renderNotification(
  localeValue: string,
  p: NotificationPayload,
): { title: string; body: string } {
  const locale = localeOf(localeValue);
  const t = createTranslator(locale, "notifications");
  switch (p.kind) {
    case "weekly": {
      const f = weeklyFigures(p, locale);
      return {
        title: t("weeklyTitle"),
        body:
          f.percent === null
            ? t("weeklyBodyNoPercent", { netWorth: f.netWorth, change: f.change, from: f.from })
            : t("weeklyBody", { netWorth: f.netWorth, change: f.change, percent: f.percent, from: f.from }),
      };
    }
    case "goal":
      return {
        title: t("goalTitle", { name: p.name }),
        body: t("goalBody", { name: p.name, target: formatMoney(p.target, "PLN", locale) }),
      };
    case "stale":
      return { title: t("staleTitle"), body: t("staleBody", { count: p.count }) };
  }
}

const PATH_OF: Record<NotificationPayload["kind"], string> = {
  weekly: "/notifications",
  goal: "/goals",
  stale: "/assets",
};

/** E-mail (z kwotami, SPEC 9) ze stopką: brak porady inwestycyjnej i link do wyłączenia. */
export function notificationEmail(
  localeValue: string,
  p: NotificationPayload,
  to: string,
  appUrl: string,
): Email {
  const locale = localeOf(localeValue);
  const t = createTranslator(locale, "email");
  const base = appUrl.replace(/\/$/, "");
  const link = `${base}${PATH_OF[p.kind]}`;
  const footer = t("notificationFooter", { prefs: `${base}/settings/notifications` });
  let subject: string;
  let body: string;
  switch (p.kind) {
    case "weekly": {
      const f = weeklyFigures(p, locale);
      subject = t("weeklySubject");
      body = t("weeklyBody", {
        ...f,
        percent: f.percent === null ? "" : ` (${f.percent})`,
        link,
      });
      break;
    }
    case "goal":
      subject = t("goalSubject", { name: p.name });
      body = t("goalBody", { name: p.name, target: formatMoney(p.target, "PLN", locale), link });
      break;
    case "stale":
      subject = t("staleSubject");
      body = t("staleBody", { count: p.count, link });
      break;
  }
  return { to, subject, text: `${body}\n\n— Neto\n\n${footer}` };
}

/** Treść push: bez kwot i nazw instrumentów (nazwa celu jest dozwolona, SPEC 9). */
export function pushMessage(localeValue: string, p: NotificationPayload): { title: string; body: string } {
  const t = createTranslator(localeOf(localeValue), "notifications");
  const body =
    p.kind === "weekly"
      ? t("pushWeekly")
      : p.kind === "goal"
        ? t("pushGoal", { name: p.name })
        : t("pushStale");
  return { title: "Neto", body };
}
