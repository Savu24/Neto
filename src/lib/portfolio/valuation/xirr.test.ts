import { describe, expect, it } from "vitest";
import { addMonths } from "./dates";
import { portfolioXirr, xirr, type XirrFlow } from "./xirr";

const close = (value: ReturnType<typeof xirr>, expected: string, tol = "1e-8") => {
  expect(value).not.toBeNull();
  expect(value!.minus(expected).abs().lte(tol)).toBe(true);
};

describe("XIRR (SPEC 7.6)", () => {
  it("rok do roku: −1000 → +1100 po 365 dniach = 10%", () => {
    close(
      xirr([
        { date: "2025-01-01", amount: -1000 },
        { date: "2026-01-01", amount: 1100 },
      ]),
      "0.1",
    );
  });

  it("przykład z dokumentacji arkusza (XIRR = 37,336%)", () => {
    const flows: XirrFlow[] = [
      { date: "2008-01-01", amount: -10000 },
      { date: "2008-03-01", amount: 2750 },
      { date: "2008-10-30", amount: 4250 },
      { date: "2009-02-15", amount: 3250 },
      { date: "2009-04-01", amount: 2750 },
    ];
    close(xirr(flows), "0.373362535", "1e-6");
  });

  it("strata: −1000 → +500 po roku = −50%", () => {
    close(
      xirr([
        { date: "2025-01-01", amount: -1000 },
        { date: "2026-01-01", amount: 500 },
      ]),
      "-0.5",
    );
  });

  it("jeden przepływ, przepływy jednego znaku lub z jednego dnia → brak wyniku („—”)", () => {
    expect(xirr([{ date: "2025-01-01", amount: -1000 }])).toBeNull();
    expect(xirr([])).toBeNull();
    expect(
      xirr([
        { date: "2025-01-01", amount: -1000 },
        { date: "2026-01-01", amount: -100 },
      ]),
    ).toBeNull();
    expect(
      xirr([
        { date: "2025-01-01", amount: -1000 },
        { date: "2025-01-01", amount: 1100 },
      ]),
    ).toBeNull();
  });

  it("kolejność wejścia nie ma znaczenia", () => {
    close(
      xirr([
        { date: "2026-01-01", amount: 1100 },
        { date: "2025-01-01", amount: -1000 },
      ]),
      "0.1",
    );
  });

  it("10 lat wpłat miesięcznych liczy się szybko", () => {
    const flows: XirrFlow[] = [];
    for (let i = 0; i < 120; i++) flows.push({ date: addMonths("2016-01-05", i), amount: -500 });
    flows.push({ date: "2026-01-05", amount: 90_000 });
    const t0 = performance.now();
    const r = xirr(flows);
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(r).not.toBeNull();
    expect(r!.gt(0.05) && r!.lt(0.08)).toBe(true);
  });
});

describe("XIRR portfela", () => {
  it("od początku: wpłaty jako przepływy ujemne, wartość końcowa dodatnia", () => {
    close(
      portfolioXirr({
        flows: [{ date: "2025-01-01", amount: 1000 }],
        endDate: "2026-01-01",
        endValue: 1100,
      }),
      "0.1",
    );
  });

  it("ostatnie 12 miesięcy: wartość początkowa jako przepływ ujemny, starsze przepływy pominięte", () => {
    // Start 1.01.2026 z wartością 1100; koniec 1210 po roku → 10%.
    close(
      portfolioXirr({
        flows: [
          { date: "2025-01-01", amount: 1000 },
          { date: "2026-01-01", amount: 5000 }, // dzień startu: już zawarty w wartości początkowej
        ],
        start: { date: "2026-01-01", value: 1100 },
        endDate: "2027-01-01",
        endValue: 1210,
      }),
      "0.1",
    );
  });

  it("wypłata z portfela zmniejsza potrzebny wzrost", () => {
    // −1000 (1.01.2025), +550 (wypłata 1.01.2026), +550 (wartość 1.01.2026): 1100 po roku = 10%
    const r = portfolioXirr({
      flows: [
        { date: "2025-01-01", amount: 1000 },
        { date: "2026-01-01", amount: -550 },
      ],
      endDate: "2026-01-01",
      endValue: 550,
    });
    close(r, "0.1");
  });
});
