import { describe, expect, it } from "vitest";
import { netWorthChanges } from "./changes";

describe("zmiany na pulpicie (SPEC 7.9)", () => {
  const snapshots = [
    { date: "2025-11-02", netWorth: 200_000 },
    { date: "2026-09-30", netWorth: 240_000 },
    { date: "2026-10-02", netWorth: 245_000 },
    { date: "2026-10-31", netWorth: 250_000 },
    { date: "2026-11-01", netWorth: 251_000 },
    { date: "2026-11-02", netWorth: 252_000 },
  ];

  it("dzienna, miesięczna i roczna", () => {
    const c = netWorthChanges(snapshots, "2026-11-02")!;
    expect(c.value.toString()).toBe("252000");
    expect(c.daily).toMatchObject({ referenceDate: "2026-11-01" });
    expect(c.daily!.amount.toString()).toBe("1000");
    expect(c.monthly).toMatchObject({ referenceDate: "2026-10-02" });
    expect(c.monthly!.amount.toString()).toBe("7000");
    expect(c.yearly).toMatchObject({ referenceDate: "2025-11-02" });
    expect(c.yearly!.amount.toString()).toBe("52000");
    expect(c.yearly!.percent!.toString()).toBe("0.26");
  });

  it("31.03 porównuje z ostatnim dniem lutego", () => {
    const c = netWorthChanges(
      [
        { date: "2026-02-27", netWorth: 100 },
        { date: "2026-02-28", netWorth: 110 },
        { date: "2026-03-31", netWorth: 121 },
      ],
      "2026-03-31",
    )!;
    expect(c.monthly).toMatchObject({ referenceDate: "2026-02-28" });
    expect(c.monthly!.percent!.toString()).toBe("0.1");
  });

  it("brak migawki w dniu odniesienia: ostatnia wcześniejsza; brak wcześniejszych → null", () => {
    const c = netWorthChanges(snapshots, "2026-10-02")!;
    expect(c.monthly).toMatchObject({ referenceDate: "2025-11-02" }); // 2.09 nie ma, ostatnia ≤ 2.09
    expect(netWorthChanges(snapshots, "2025-11-02")!.daily).toBeNull();
    expect(netWorthChanges(snapshots, "2025-11-02")!.monthly).toBeNull();
    expect(netWorthChanges(snapshots, "2025-01-01")).toBeNull();
  });

  it("przy wartości odniesienia ≤ 0 procentu nie ma", () => {
    const c = netWorthChanges(
      [
        { date: "2026-11-01", netWorth: -1000 },
        { date: "2026-11-02", netWorth: 500 },
      ],
      "2026-11-02",
    )!;
    expect(c.daily!.amount.toString()).toBe("1500");
    expect(c.daily!.percent).toBeNull();
    const zero = netWorthChanges(
      [
        { date: "2026-11-01", netWorth: 0 },
        { date: "2026-11-02", netWorth: 500 },
      ],
      "2026-11-02",
    )!;
    expect(zero.daily!.percent).toBeNull();
  });
});
