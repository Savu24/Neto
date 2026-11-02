import { describe, expect, it } from "vitest";
import { normalizeNumber, parseAssumptions, specDefaults, type AssumptionValues } from "./assumptions";

const filled: AssumptionValues = {
  ...specDefaults,
  currentAge: "34",
  retireAge: "60",
  startingCapital: "422 870",
  monthlyContribution: "3500",
  monthlySpending: "9000",
  zusMonthly: "2500",
};

describe("normalizeNumber", () => {
  it("usuwa spacje i zamienia przecinek", () => {
    expect(normalizeNumber("1 234,50")).toBe("1234.50");
    expect(normalizeNumber("−1,5")).toBe("-1.5");
  });
});

describe("parseAssumptions", () => {
  it("domyślne wartości z SPEC czekają na wiek", () => {
    expect(parseAssumptions(specDefaults).status).toBe("missingAge");
  });

  it("procenty zamienia na ułamki, pusty ZUS to 0, puste wydatki to null", () => {
    const res = parseAssumptions({ ...filled, zusMonthly: "", monthlySpending: "" });
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;
    expect(res.input.withdrawalRate).toBe("0.04");
    expect(res.input.returns).toEqual({ low: "0.01", base: "0.03", high: "0.05" });
    expect(res.input.startingCapital).toBe("422870");
    expect(res.input.zusMonthly).toBe("0");
    expect(res.input.monthlySpending).toBeNull();
  });

  it("zgłasza błędy pól", () => {
    const res = parseAssumptions({
      ...filled,
      currentAge: "34,5",
      startingCapital: "abc",
      monthlyContribution: "-5",
      withdrawalRate: "0",
    });
    expect(res.status).toBe("invalid");
    if (res.status !== "invalid") return;
    expect(res.errors.currentAge).toEqual({ key: "errorInteger" });
    expect(res.errors.startingCapital).toEqual({ key: "errorNumber" });
    expect(res.errors.monthlyContribution).toEqual({ key: "errorMin", params: { min: "0" } });
    expect(res.errors.withdrawalRate?.key).toBe("errorRange");
  });

  it("wiek emerytalny nie może być niższy niż obecny ani wyższy niż 80", () => {
    const low = parseAssumptions({ ...filled, retireAge: "30" });
    expect(low.status === "invalid" && low.errors.retireAge).toEqual({
      key: "errorRange",
      params: { min: "34", max: "80" },
    });
    expect(parseAssumptions({ ...filled, retireAge: "81" }).status).toBe("invalid");
  });
});
