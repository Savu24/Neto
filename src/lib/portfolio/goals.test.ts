import { describe, expect, it } from "vitest";
import {
  averageMonthlyGrowth,
  evaluateGoal,
  fullMonthsBetween,
  goalPace,
  goalProgress,
  requiredMonthlyContribution,
  savingsPlan,
} from "./goals";

describe("goalProgress", () => {
  it("bieżąca wartość ÷ kwota celu", () => {
    expect(goalProgress("52300", "60000")?.toFixed(4)).toBe("0.8717");
  });

  it("może przekroczyć 100%", () => {
    expect(goalProgress(1500, 1000)?.toString()).toBe("1.5");
  });

  it("przy celu 0 nie ma procentu", () => {
    expect(goalProgress(100, 0)).toBeNull();
    expect(goalProgress(100, -5)).toBeNull();
  });
});

describe("fullMonthsBetween", () => {
  it("liczy tylko pełne miesiące", () => {
    expect(fullMonthsBetween("2026-11-02", "2027-03-31")).toBe(4);
    expect(fullMonthsBetween("2026-11-02", "2027-03-02")).toBe(4);
    expect(fullMonthsBetween("2026-11-02", "2027-03-01")).toBe(3);
  });

  it("termin w przeszłości daje 0", () => {
    expect(fullMonthsBetween("2026-11-02", "2026-01-01")).toBe(0);
  });

  it("odrzuca zły format daty", () => {
    expect(() => fullMonthsBetween("2.11.2026", "2027-01-01")).toThrow();
  });
});

describe("requiredMonthlyContribution", () => {
  it("(cel − bieżąca) ÷ pełne miesiące", () => {
    const r = requiredMonthlyContribution("52300", "60000", 5);
    expect(r).toMatchObject({ kind: "monthly", months: 5 });
    expect(r.kind === "monthly" && r.amount.toString()).toBe("1540");
  });

  it("cel osiągnięty", () => {
    expect(requiredMonthlyContribution(60000, 60000, 5).kind).toBe("achieved");
  });

  it("bez terminu i po terminie", () => {
    expect(requiredMonthlyContribution(1, 10, null).kind).toBe("noDeadline");
    const passed = requiredMonthlyContribution(1, 10, 0);
    expect(passed.kind === "deadlinePassed" && passed.remaining.toString()).toBe("9");
  });
});

describe("averageMonthlyGrowth i goalPace", () => {
  it("średni przyrost z 3 miesięcy", () => {
    expect(averageMonthlyGrowth("52300", "46570").toString()).toBe("1910");
  });

  it("w dobrym tempie, gdy przyrost ≥ potrzebna wpłata", () => {
    const req = requiredMonthlyContribution("52300", "60000", 5);
    expect(goalPace(req, "1910").kind).toBe("onTrack");
    expect(goalPace(req, "1540").kind).toBe("onTrack");
  });

  it("poniżej tempa o różnicę", () => {
    const req = requiredMonthlyContribution("9800", "24000", 10);
    const pace = goalPace(req, "1070");
    expect(pace.kind === "behind" && pace.shortfall.toString()).toBe("350");
  });

  it("bez historii albo bez terminu tempo nieznane", () => {
    const req = requiredMonthlyContribution(1, 10, 3);
    expect(goalPace(req, null).kind).toBe("unknown");
    expect(goalPace(requiredMonthlyContribution(1, 10, null), "5").kind).toBe("unknown");
  });
});

describe("evaluateGoal", () => {
  it("łączy postęp, wpłatę i tempo (przykład z makiety)", () => {
    const status = evaluateGoal({
      current: "52300",
      target: "60000",
      deadline: "2027-04-02",
      today: "2026-11-02",
      valueThreeMonthsAgo: "46570",
    });
    expect(status.progress?.toFixed(2)).toBe("0.87");
    expect(status.required.kind === "monthly" && status.required.amount.toString()).toBe("1540");
    expect(status.averageGrowth?.toString()).toBe("1910");
    expect(status.pace.kind).toBe("onTrack");
  });

  it("cel 0: brak procentu, cel osiągnięty", () => {
    const status = evaluateGoal({
      current: 10,
      target: 0,
      deadline: null,
      today: "2026-11-02",
      valueThreeMonthsAgo: null,
    });
    expect(status.progress).toBeNull();
    expect(status.required.kind).toBe("achieved");
  });
});

describe("savingsPlan", () => {
  it("50 000 zł za 3 lata od zera: dziennie, tygodniowo i miesięcznie", () => {
    const plan = savingsPlan(0, 50000, "2026-11-03", "2029-11-03");
    expect(plan.kind).toBe("plan");
    if (plan.kind !== "plan") return;
    expect(plan.days).toBe(1096);
    expect(plan.months).toBe(36);
    expect(plan.perMonth?.toFixed(2)).toBe("1388.89");
    expect(plan.perDay.toFixed(2)).toBe("45.62");
    expect(plan.perWeek.toFixed(2)).toBe("319.34");
  });

  it("odlicza już odłożoną kwotę", () => {
    const plan = savingsPlan("14000", "50000", "2026-11-03", "2029-11-03");
    expect(plan.kind === "plan" && plan.remaining.toFixed()).toBe("36000");
    expect(plan.kind === "plan" && plan.perMonth?.toFixed()).toBe("1000");
  });

  it("mniej niż miesiąc do terminu: bez kwoty miesięcznej", () => {
    const plan = savingsPlan(0, 700, "2026-11-03", "2026-11-17");
    expect(plan.kind === "plan" && plan.perMonth).toBeNull();
    expect(plan.kind === "plan" && plan.perDay.toFixed()).toBe("50");
  });

  it("cel osiągnięty, bez terminu albo po terminie", () => {
    expect(savingsPlan(500, 500, "2026-11-03", "2027-01-01").kind).toBe("achieved");
    expect(savingsPlan(0, 500, "2026-11-03", null)).toMatchObject({ kind: "noDeadline" });
    expect(savingsPlan(0, 500, "2026-11-03", "2026-11-03")).toMatchObject({ kind: "deadlinePassed" });
  });
});
