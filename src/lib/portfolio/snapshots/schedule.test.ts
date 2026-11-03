import { describe, expect, it } from "vitest";
import { netWorthAt } from "@/lib/portfolio/valuation";
import { mergeDates, missingRanges, recalcDates, snapshotDates, snapshotRow } from "./schedule";

describe("snapshotDates", () => {
  it("dzień początkowy, końce miesięcy i ostatnie 31 dni", () => {
    const dates = snapshotDates("2026-06-15", "2026-11-03");
    expect(dates.slice(0, 5)).toEqual(["2026-06-15", "2026-06-30", "2026-07-31", "2026-08-31", "2026-09-30"]);
    // codziennie od 04.10 (31 dni do 03.11 włącznie), koniec października w środku
    expect(dates.slice(5)).toHaveLength(31);
    expect(dates[5]).toBe("2026-10-04");
    expect(dates.at(-1)).toBe("2026-11-03");
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("luty i koniec roku przez przycinanie miesięcy", () => {
    const dates = snapshotDates("2023-12-31", "2024-04-30", 1);
    expect(dates).toEqual(["2023-12-31", "2024-01-31", "2024-02-29", "2024-03-31", "2024-04-30"]);
  });

  it("krótki zakres to same dni, pusty przy odwróconym zakresie", () => {
    expect(snapshotDates("2026-11-01", "2026-11-03")).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"]);
    expect(snapshotDates("2026-11-04", "2026-11-03")).toEqual([]);
  });
});

describe("recalcDates", () => {
  it("istniejące migawki od D i harmonogram od D, bez starszych", () => {
    const existing = ["2025-12-31", "2026-01-31", "2026-02-10", "2026-11-02"];
    const dates = recalcDates(existing, "2026-02-01", "2026-11-03");
    expect(dates).toContain("2026-02-01");
    expect(dates).toContain("2026-02-10");
    expect(dates).toContain("2026-11-02");
    expect(dates).not.toContain("2026-01-31");
    expect(dates.filter((d) => d < "2026-10-04")).toEqual([
      "2026-02-01",
      "2026-02-10",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
      "2026-06-30",
      "2026-07-31",
      "2026-08-31",
      "2026-09-30",
    ]);
  });

  it("harmonogram nie zaczyna się przed pierwszymi danymi, istniejące migawki są przeliczane", () => {
    const dates = recalcDates(["2026-01-31"], "2026-01-01", "2026-03-31", "2026-03-15");
    expect(dates.filter((d) => d < "2026-03-01")).toEqual(["2026-01-31"]);
    expect(dates[1]).toBe("2026-03-15");
  });
});

describe("missingRanges", () => {
  const needed = { from: "2026-01-01", to: "2026-11-03" };
  it("bez danych cały zakres", () => {
    expect(missingRanges(needed, null)).toEqual([needed]);
  });
  it("brakujący początek i koniec", () => {
    expect(missingRanges(needed, { from: "2026-03-02", to: "2026-10-30" })).toEqual([
      { from: "2026-01-01", to: "2026-03-01" },
      { from: "2026-10-31", to: "2026-11-03" },
    ]);
  });
  it("nic, gdy zakres pokryty", () => {
    expect(missingRanges(needed, { from: "2025-12-01", to: "2026-11-03" })).toEqual([]);
  });
  it("zapisany zakres w całości po potrzebnym", () => {
    expect(
      missingRanges({ from: "2026-01-01", to: "2026-01-10" }, { from: "2026-02-01", to: "2026-02-05" }),
    ).toEqual([{ from: "2026-01-01", to: "2026-01-10" }]);
  });
});

describe("snapshotRow", () => {
  it("kwoty z 4 miejscami, mapy jako napisy", () => {
    const result = netWorthAt(
      [
        {
          id: "a1",
          kind: "ASSET",
          positions: [
            { kind: "cash", currency: "PLN", flows: [{ date: "2026-01-01", amount: "100.12345" }] },
          ],
        },
        {
          id: "l1",
          kind: "LIABILITY",
          positions: [
            { kind: "liability", currency: "PLN", balances: [{ date: "2026-01-01", amount: "40" }] },
          ],
        },
      ],
      "2026-01-02",
      {},
    );
    expect(snapshotRow(result)).toEqual({
      date: "2026-01-02",
      assets: "100.1235",
      liabilities: "40.0000",
      netWorth: "60.1235",
      byClass: { cash: "100.1235" },
      byCurrency: { PLN: "100.1235" },
      byAccount: { a1: "100.1235", l1: "-40.0000" },
      staleCount: 0,
    });
  });

  it("mergeDates łączy bez powtórzeń", () => {
    expect(mergeDates(["2026-01-02", "2026-01-01"], ["2026-01-02"])).toEqual(["2026-01-01", "2026-01-02"]);
  });
});
