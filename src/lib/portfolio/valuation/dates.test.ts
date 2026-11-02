import { describe, expect, it } from "vitest";
import { businessDaysBetween, easterSunday, isBusinessDay, previousBusinessDay } from "./calendar";
import { addDays, addMonths, daysBetween, eachDay, endOfMonth, isDateKey, todayKey } from "./dates";
import { lastOnOrBefore } from "./series";
import { isStale, staleness } from "./staleness";

describe("daty dni wyceny", () => {
  it("sprawdza format i istnienie dnia", () => {
    expect(isDateKey("2026-11-02")).toBe(true);
    expect(isDateKey("2026-02-29")).toBe(false);
    expect(isDateKey("2024-02-29")).toBe(true);
    expect(isDateKey("2026-11-2")).toBe(false);
  });

  it("dodaje miesiące z przycięciem do końca miesiąca", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonths("2026-11-15", -12)).toBe("2025-11-15");
    expect(addMonths("2026-12-10", 1)).toBe("2027-01-10");
  });

  it("liczy dni bez wpływu zmiany czasu", () => {
    expect(daysBetween("2026-01-01", "2027-01-01")).toBe(365);
    expect(daysBetween("2024-01-01", "2025-01-01")).toBe(366);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2); // zmiana czasu 29.03.2026
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26"); // zmiana czasu 25.10.2026
    expect(endOfMonth("2028-02-10")).toBe("2028-02-29");
    expect(eachDay("2026-10-30", "2026-11-02")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });

  it("dzień wyceny to data w Warszawie", () => {
    // 23:30 UTC 2.11 = 00:30 3.11 w Warszawie (czas zimowy).
    expect(todayKey(new Date("2026-11-02T23:30:00Z"))).toBe("2026-11-03");
  });

  it("ostatni punkt ≤ D, przy tej samej dacie wygrywa później wpisany", () => {
    const points = [
      { date: "2026-11-02", v: "b" },
      { date: "2026-10-30", v: "a" },
      { date: "2026-11-02", v: "c" },
    ];
    expect(lastOnOrBefore(points, "2026-11-01")?.v).toBe("a");
    expect(lastOnOrBefore(points, "2026-11-02")?.v).toBe("c");
    expect(lastOnOrBefore(points, "2026-10-01")).toBeUndefined();
  });
});

describe("kalendarz dni roboczych PL", () => {
  it("Wielkanoc", () => {
    expect(easterSunday(2024)).toBe("2024-03-31");
    expect(easterSunday(2025)).toBe("2025-04-20");
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
  });

  it("święta ustawowe i weekendy", () => {
    expect(isBusinessDay("2026-11-02")).toBe(true);
    expect(isBusinessDay("2026-11-11")).toBe(false);
    expect(isBusinessDay("2026-04-06")).toBe(false); // poniedziałek wielkanocny
    expect(isBusinessDay("2026-06-04")).toBe(false); // Boże Ciało
    expect(isBusinessDay("2026-12-24")).toBe(false); // Wigilia wolna od 2025
    expect(isBusinessDay("2024-12-24")).toBe(true);
    expect(isBusinessDay("2026-10-31")).toBe(false);
    expect(isBusinessDay("2026-11-11", "WEEKDAYS")).toBe(true);
    expect(previousBusinessDay("2026-11-02")).toBe("2026-10-30");
  });

  it("dni robocze między datami (od wyłącznie, do włącznie)", () => {
    expect(businessDaysBetween("2026-10-28", "2026-11-02")).toBe(3);
    expect(businessDaysBetween("2026-11-10", "2026-11-12")).toBe(1);
    expect(businessDaysBetween("2026-11-02", "2026-11-02")).toBe(0);
    expect(businessDaysBetween("2026-11-05", "2026-11-02")).toBe(0);
  });
});

describe("nieaktualne wyceny (SPEC 7.8)", () => {
  it("cena: starsza niż 3 dni robocze", () => {
    expect(staleness("price", "2026-10-28", "2026-11-02")).toMatchObject({ age: 3, stale: false });
    expect(staleness("price", "2026-10-28", "2026-11-03")).toMatchObject({ age: 4, stale: true });
  });

  it("kurs przez święta Bożego Narodzenia nie robi się nieaktualny", () => {
    // 23.12 (śr.) → 29.12 (wt.): 24, 25 święta, 26–27 weekend, roboczy tylko 28 i 29.
    expect(staleness("fx", "2026-12-23", "2026-12-29")).toMatchObject({ age: 2, stale: false });
    expect(staleness("fx", "2026-12-23", "2026-12-29", "WEEKDAYS")).toMatchObject({ age: 4, stale: true });
  });

  it("aktywo ręczne po 90 dniach, zobowiązanie po 35", () => {
    expect(isStale("manual", "2026-06-12", "2026-09-09")).toBe(false); // 89 dni
    expect(isStale("manual", "2026-06-12", "2026-09-10")).toBe(true); // 90 dni
    expect(isStale("liability", "2026-10-01", "2026-11-04")).toBe(false); // 34 dni
    expect(isStale("liability", "2026-10-01", "2026-11-05")).toBe(true); // 35 dni
  });
});
