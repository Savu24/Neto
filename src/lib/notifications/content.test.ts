import { describe, expect, it } from "vitest";
import {
  notificationEmail,
  parsePayload,
  pushMessage,
  renderNotification,
  type NotificationPayload,
} from "./content";
import { CONFIGURABLE_TYPES, prefField, prefsFromForm, resolvePrefs } from "./prefs";
import { weekWindow } from "./service";

const weekly: NotificationPayload = {
  kind: "weekly",
  from: "2026-10-25",
  to: "2026-11-01",
  netWorth: "123456.78",
  change: "-1234.5",
  percent: "-0.0099",
};
const goal: NotificationPayload = { kind: "goal", goalId: "g1", name: "Poduszka", target: "20000" };
const stale: NotificationPayload = { kind: "stale", count: 3 };

describe("treści powiadomień", () => {
  it("lista w aplikacji po polsku i angielsku", () => {
    expect(renderNotification("pl", weekly)).toEqual({
      title: "Podsumowanie tygodnia",
      body: expect.stringMatching(
        /^Wartość netto 123\s456,78\s*zł\. Zmiana od 25\.10\.2026: −1234,50\s*zł \(−1,0%\)\.$/,
      ),
    });
    expect(renderNotification("en", weekly).body).toMatch(
      /^Net worth PLN\s?123,456\.78\. Change since 25\/10\/2026: −PLN\s?1,234\.50 \(−1\.0%\)\.$/,
    );
    expect(renderNotification("en", goal).title).toBe("Goal reached: Poduszka");
    expect(renderNotification("pl", stale).body).toContain(": 3.");
    expect(renderNotification("pl", { ...weekly, percent: null }).body).not.toContain("%");
  });

  it("e-mail z kwotami, linkiem i stopką; nieznany język = polski", () => {
    const mail = notificationEmail("xx", weekly, "a@example.com", "https://neto.test/");
    expect(mail.to).toBe("a@example.com");
    expect(mail.subject).toBe("Podsumowanie tygodnia w Neto");
    expect(mail.text).toContain("https://neto.test/notifications");
    expect(mail.text).toContain("nie stanowią porady inwestycyjnej");
    expect(mail.text).toContain("https://neto.test/settings/notifications");
    expect(notificationEmail("en", goal, "a@example.com", "https://neto.test").text).toContain(
      "https://neto.test/goals",
    );
  });

  it("push nigdy nie zawiera kwot", () => {
    for (const p of [weekly, goal, stale]) {
      for (const locale of ["pl", "en"]) {
        const { body } = pushMessage(locale, p);
        expect(body).not.toMatch(/\d/);
        expect(body).not.toMatch(/zł|PLN/);
      }
    }
    expect(pushMessage("pl", goal).body).toBe("Osiągnięto cel: Poduszka");
  });

  it("odczyt danych z bazy odrzuca obce kształty", () => {
    expect(parsePayload({ ...weekly, key: "weekly:2026-11-01", inApp: true })).toEqual(weekly);
    expect(parsePayload({ kind: "goal", name: "x" })).toBeNull();
    expect(parsePayload(null)).toBeNull();
    expect(parsePayload({ kind: "security" })).toBeNull();
  });
});

describe("okres podsumowania", () => {
  it("ostatni pełny tydzień przed bieżącym poniedziałkiem, w każdy dzień tygodnia ten sam", () => {
    const expected = { from: "2026-10-25", to: "2026-11-01" };
    for (const day of ["2026-11-02", "2026-11-03", "2026-11-08"]) expect(weekWindow(day)).toEqual(expected);
    expect(weekWindow("2026-11-09")).toEqual({ from: "2026-11-01", to: "2026-11-08" });
  });
});

describe("preferencje", () => {
  it("brak wpisu = włączone", () => {
    const prefs = resolvePrefs([{ type: "WEEKLY_SUMMARY", channel: "EMAIL", enabled: false }]);
    expect(prefs("WEEKLY_SUMMARY", "EMAIL")).toBe(false);
    expect(prefs("WEEKLY_SUMMARY", "IN_APP")).toBe(true);
    expect(prefs("GOAL_ACHIEVED", "PUSH")).toBe(true);
  });

  it("formularz: zaznaczone = włączone; e-mail nieedytowalny zostaje bez zmian", () => {
    const fd = new FormData();
    fd.set(prefField("WEEKLY_SUMMARY", "IN_APP"), "on");
    fd.set(prefField("GOAL_ACHIEVED", "EMAIL"), "on");
    const current = resolvePrefs([{ type: "STALE_VALUATION", channel: "EMAIL", enabled: false }]);

    const rows = prefsFromForm(fd, { emailEditable: true, current });
    expect(rows).toHaveLength(CONFIGURABLE_TYPES.length * 2);
    expect(rows).toContainEqual({ type: "WEEKLY_SUMMARY", channel: "IN_APP", enabled: true });
    expect(rows).toContainEqual({ type: "WEEKLY_SUMMARY", channel: "EMAIL", enabled: false });
    expect(rows).toContainEqual({ type: "GOAL_ACHIEVED", channel: "EMAIL", enabled: true });

    const locked = prefsFromForm(fd, { emailEditable: false, current });
    expect(locked).toContainEqual({ type: "WEEKLY_SUMMARY", channel: "EMAIL", enabled: true });
    expect(locked).toContainEqual({ type: "STALE_VALUATION", channel: "EMAIL", enabled: false });
  });
});
