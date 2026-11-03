import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { scopedDb } from "@/lib/db/scoped";
import type { Email } from "@/lib/email/send";
import { createGoal } from "@/lib/portfolio/goal-service";
import { parseGoalInput } from "@/lib/portfolio/goal-input";
import { parseAccountInput } from "@/lib/portfolio/ledger/account-input";
import { createAccount } from "@/lib/portfolio/ledger/service";
import { resetDb, testDb } from "../../../tests/db";
import { runNotificationsForAll } from "./cron";
import { loadPrefs, savePrefs } from "./prefs";
import {
  listNotifications,
  markAllRead,
  markRead,
  runNotifications,
  unreadCount,
  type NotifyDeps,
} from "./service";

const base = testDb();
const today = "2026-11-03"; // wtorek; ostatni pełny tydzień: 26.10–1.11, zmiana od 25.10
const NOW = new Date("2026-11-03T08:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

async function user(email: string, verified = true) {
  const u = await base.user.create({ data: { email, emailVerified: verified ? NOW : null } });
  return { db: scopedDb(base, u.id), userId: u.id, today };
}
type U = Awaited<ReturnType<typeof user>>;

function deps(overrides: Partial<NotifyDeps> = {}) {
  const sent: Email[] = [];
  const d: NotifyDeps = {
    mail: async (e) => {
      sent.push(e);
      return { delivered: true };
    },
    emailEnabled: true,
    push: null,
    appUrl: "https://neto.test",
    ...overrides,
  };
  return { deps: d, sent };
}

async function account(l: U, fields: Record<string, string>) {
  return createAccount(l, parseAccountInput({ currency: "PLN", ...fields }, today, "create"));
}

const run = (l: U, d: NotifyDeps, now = NOW) => runNotifications(l.db, l.userId, d, now);

beforeEach(() => resetDb(base));
afterAll(() => base.$disconnect());

describe("podsumowanie tygodnia", () => {
  it("liczy zmianę z transakcji, wysyła e-mail z kwotami i drugi przebieg niczego nie dubluje", async () => {
    const l = await user("a@example.com");
    await account(l, {
      name: "Oszczędności",
      type: "SAVINGS",
      openingAmount: "10000",
      openingDate: "2026-10-01",
    });
    await account(l, { name: "Konto", type: "CHECKING", openingAmount: "500", openingDate: "2026-10-28" });
    const { deps: d, sent } = deps();

    const first = await run(l, d);
    expect(first.created).toEqual(["WEEKLY_SUMMARY"]);
    const [n] = await listNotifications(l.db);
    expect(n.data).toMatchObject({
      kind: "weekly",
      from: "2026-10-25",
      to: "2026-11-01",
      change: "500",
      percent: "0.05",
    });
    expect(n.title).toBe("Podsumowanie tygodnia");
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe("Podsumowanie tygodnia w Neto");
    expect(sent[0].text).toMatch(/\+500,00\s*zł \(\+5,0%\)/);
    expect(sent[0].text).toContain("https://neto.test/settings/notifications");

    // Ten sam tydzień, późniejszy dzień: ten sam klucz okresu, nic nowego.
    const again = await run(l, d, new Date(NOW.getTime() + 2 * DAY));
    expect(again.created).toEqual([]);
    expect(sent).toHaveLength(1);
    expect(await base.notification.count()).toBe(1);

    // Następny tydzień: nowe podsumowanie.
    const next = await run(l, d, new Date(NOW.getTime() + 7 * DAY));
    expect(next.created).toEqual(["WEEKLY_SUMMARY"]);
  });

  it("bierze wartości z migawek, gdy są", async () => {
    const l = await user("b@example.com");
    await account(l, { name: "Konto", type: "CHECKING", openingAmount: "1", openingDate: "2026-10-01" });
    const snap = (date: string, netWorth: string) => ({
      userId: l.userId,
      date: new Date(`${date}T00:00:00Z`),
      assets: netWorth,
      liabilities: "0",
      netWorth,
      byClass: {},
      byCurrency: {},
      byAccount: {},
    });
    await base.portfolioSnapshot.createMany({
      data: [snap("2026-10-25", "20000"), snap("2026-11-01", "19000")],
    });

    await run(l, deps().deps);
    const [n] = await listNotifications(l.db);
    expect(n.data).toMatchObject({ netWorth: "19000", change: "-1000", percent: "-0.05" });
  });

  it("dwa równoległe przebiegi tworzą jedno podsumowanie", async () => {
    const l = await user("c@example.com");
    await account(l, { name: "Konto", type: "CHECKING", openingAmount: "100", openingDate: "2026-10-01" });
    const { deps: d, sent } = deps();
    await Promise.all([run(l, d), run(l, d), run(l, d)]);
    expect(await base.notification.count({ where: { type: "WEEKLY_SUMMARY" } })).toBe(1);
    expect(sent).toHaveLength(1);
  });

  it("bez kont nie ma podsumowania", async () => {
    const l = await user("d@example.com");
    expect((await run(l, deps().deps)).created).toEqual([]);
  });
});

describe("osiągnięty cel", () => {
  it("raz na cel: ustawia achievedAt i nie wraca w kolejnych przebiegach", async () => {
    const l = await user("e@example.com");
    const goalId = await createGoal(
      l.db,
      l.userId,
      parseGoalInput({ name: "Poduszka", targetAmount: "1000", savedAmount: "1000" }, [], today),
    );
    await createGoal(l.db, l.userId, parseGoalInput({ name: "Dom", targetAmount: "500000" }, [], today));
    const { deps: d, sent } = deps();

    expect((await run(l, d)).created).toEqual(["GOAL_ACHIEVED"]);
    const [n] = await listNotifications(l.db);
    expect(n.title).toBe("Osiągnięto cel: Poduszka");
    expect(sent[0].subject).toBe("Osiągnięto cel: Poduszka");
    expect((await base.goal.findUniqueOrThrow({ where: { id: goalId } })).achievedAt).toEqual(NOW);

    expect((await run(l, d, new Date(NOW.getTime() + DAY))).created).toEqual([]);
    expect(sent).toHaveLength(1);
  });

  it("wyłączony we wszystkich kanałach: bez wpisu, ale cel oznaczony, żeby nie wrócił po włączeniu", async () => {
    const l = await user("f@example.com");
    const goalId = await createGoal(
      l.db,
      l.userId,
      parseGoalInput({ name: "Wakacje", targetAmount: "100", savedAmount: "200" }, [], today),
    );
    await savePrefs(l.db, l.userId, [
      { type: "GOAL_ACHIEVED", channel: "IN_APP", enabled: false },
      { type: "GOAL_ACHIEVED", channel: "EMAIL", enabled: false },
    ]);
    const { deps: d, sent } = deps();
    expect((await run(l, d)).created).toEqual([]);
    expect(sent).toHaveLength(0);
    expect(await base.notification.count()).toBe(0);
    expect((await base.goal.findUniqueOrThrow({ where: { id: goalId } })).achievedAt).not.toBeNull();

    await savePrefs(l.db, l.userId, [{ type: "GOAL_ACHIEVED", channel: "IN_APP", enabled: true }]);
    expect((await run(l, d)).created).toEqual([]);
  });
});

describe("wycena do aktualizacji", () => {
  it("najwyżej raz na 7 dni", async () => {
    const l = await user("g@example.com");
    await account(l, {
      name: "Mieszkanie",
      type: "REAL_ESTATE",
      openingAmount: "500000",
      openingDate: "2026-06-01",
    });
    await savePrefs(l.db, l.userId, [
      { type: "WEEKLY_SUMMARY", channel: "IN_APP", enabled: false },
      { type: "WEEKLY_SUMMARY", channel: "EMAIL", enabled: false },
    ]);
    const { deps: d, sent } = deps();

    expect((await run(l, d)).created).toEqual(["STALE_VALUATION"]);
    const [n] = await listNotifications(l.db);
    expect(n.data).toMatchObject({ kind: "stale", count: 1 });
    expect(sent[0].text).not.toMatch(/500\s?000/);

    expect((await run(l, d, new Date(NOW.getTime() + 6 * DAY))).created).toEqual([]);
    expect((await run(l, d, new Date(NOW.getTime() + 8 * DAY))).created).toEqual(["STALE_VALUATION"]);
  });
});

describe("preferencje i kanały", () => {
  it("wyłączony kanał w aplikacji: e-mail wychodzi, wpis jest ukryty i nie liczy się jako nieprzeczytany", async () => {
    const l = await user("h@example.com");
    await account(l, { name: "Konto", type: "CHECKING", openingAmount: "100", openingDate: "2026-10-01" });
    await savePrefs(l.db, l.userId, [{ type: "WEEKLY_SUMMARY", channel: "IN_APP", enabled: false }]);
    const { deps: d, sent } = deps();

    expect((await run(l, d)).created).toEqual(["WEEKLY_SUMMARY"]);
    expect(sent).toHaveLength(1);
    expect(await listNotifications(l.db)).toEqual([]);
    expect(await unreadCount(l.db)).toBe(0);
    // Ukryty wpis pilnuje idempotencji: drugi przebieg nie wysyła drugiego e-maila.
    await run(l, d, new Date(NOW.getTime() + DAY));
    expect(sent).toHaveLength(1);
  });

  it("wyłączony e-mail albo niepotwierdzony adres: tylko w aplikacji", async () => {
    const off = await user("i@example.com");
    const unverified = await user("j@example.com", false);
    for (const l of [off, unverified])
      await account(l, { name: "Konto", type: "CHECKING", openingAmount: "100", openingDate: "2026-10-01" });
    await savePrefs(off.db, off.userId, [{ type: "WEEKLY_SUMMARY", channel: "EMAIL", enabled: false }]);
    const { deps: d, sent } = deps();

    await run(off, d);
    await run(unverified, d);
    expect(sent).toHaveLength(0);
    expect(await unreadCount(off.db)).toBe(1);
    expect(await unreadCount(unverified.db)).toBe(1);
  });

  it("bez dostawcy poczty (flaga) nic nie wysyła", async () => {
    const l = await user("k@example.com");
    await account(l, { name: "Konto", type: "CHECKING", openingAmount: "100", openingDate: "2026-10-01" });
    const { deps: d, sent } = deps({ emailEnabled: false });
    const res = await run(l, d);
    expect(res).toMatchObject({ created: ["WEEKLY_SUMMARY"], emailed: 0 });
    expect(sent).toHaveLength(0);
  });

  it("push tylko z włączoną flagą, z treścią bez kwot", async () => {
    const l = await user("l@example.com");
    await account(l, { name: "Konto", type: "CHECKING", openingAmount: "100", openingDate: "2026-10-01" });
    await base.pushDevice.create({ data: { userId: l.userId, token: "tok-1" } });
    const pushes: string[] = [];
    const { deps: d } = deps({
      push: async (tokens, m) => {
        pushes.push(`${tokens.join(",")}|${m.body}`);
        return tokens.length;
      },
    });
    const res = await run(l, d);
    expect(res.pushed).toBe(1);
    expect(pushes).toEqual(["tok-1|Masz nowe podsumowanie tygodnia"]);
  });

  it("zapis i odczyt preferencji (upsert)", async () => {
    const l = await user("m@example.com");
    await savePrefs(l.db, l.userId, [{ type: "STALE_VALUATION", channel: "EMAIL", enabled: false }]);
    await savePrefs(l.db, l.userId, [
      { type: "STALE_VALUATION", channel: "EMAIL", enabled: true },
      { type: "STALE_VALUATION", channel: "IN_APP", enabled: false },
    ]);
    const prefs = await loadPrefs(l.db);
    expect(prefs("STALE_VALUATION", "EMAIL")).toBe(true);
    expect(prefs("STALE_VALUATION", "IN_APP")).toBe(false);
    expect(prefs("WEEKLY_SUMMARY", "IN_APP")).toBe(true);
    expect(await base.notificationPref.count()).toBe(2);
  });
});

describe("izolacja użytkowników", () => {
  it("lista, licznik i oznaczanie działają tylko na własnych wpisach", async () => {
    const a = await user("n@example.com");
    const b = await user("o@example.com");
    await account(a, { name: "Konto", type: "CHECKING", openingAmount: "100", openingDate: "2026-10-01" });
    await run(a, deps().deps);
    // Przebieg B nie tworzy niczego dla A ani dla siebie (B nie ma danych).
    await run(b, deps().deps);
    const [mine] = await listNotifications(a.db);

    expect(await listNotifications(b.db)).toEqual([]);
    await markRead(b.db, mine.id);
    expect(await markAllRead(b.db)).toBe(0);
    expect(await unreadCount(a.db)).toBe(1);

    await markRead(a.db, mine.id);
    expect(await unreadCount(a.db)).toBe(0);
  });

  it("wpis bez data.inApp (np. bezpieczeństwo) jest widoczny", async () => {
    const l = await user("p@example.com");
    await base.notification.create({ data: { userId: l.userId, type: "SECURITY", title: "T", body: "B" } });
    await base.notification.create({
      data: { userId: l.userId, type: "SECURITY", title: "T2", body: "B2", data: { other: 1 } },
    });
    expect(await unreadCount(l.db)).toBe(2);
    expect(await markAllRead(l.db)).toBe(2);
  });
});

describe("cron", () => {
  it("przechodzi wszystkich użytkowników partiami i pomija konta w trakcie usuwania", async () => {
    const users = await Promise.all(["q", "r", "s"].map((p) => user(`${p}@example.com`)));
    for (const l of users)
      await account(l, { name: "Konto", type: "CHECKING", openingAmount: "100", openingDate: "2026-10-01" });
    await base.user.update({ where: { id: users[2].userId }, data: { deletionRequestedAt: NOW } });
    const { deps: d } = deps();

    const summary = await runNotificationsForAll(base, d, NOW, 1);
    expect(summary).toMatchObject({ users: 2, created: { WEEKLY_SUMMARY: 2 }, emailed: 2, failed: 0 });
    expect(await base.notification.count({ where: { userId: users[2].userId } })).toBe(0);

    const again = await runNotificationsForAll(base, d, NOW, 1);
    expect(again).toMatchObject({ users: 2, created: {}, emailed: 0 });
  });
});
