import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { D } from "@/lib/money";
import {
  HORIZON_AGE,
  calculateRetirement,
  futureValue,
  monthlyRate,
  requiredCapital,
  toNominal,
  type RetirementInput,
} from "./retirement";

const mockup: RetirementInput = {
  currentAge: 34,
  retireAge: 60,
  startingCapital: "422870",
  monthlyContribution: "3500",
  monthlySpending: "9000",
  zusMonthly: "2500",
  withdrawalRate: "0.04",
  returns: { low: "0.01", base: "0.03", high: "0.05" },
  inflation: "0.03",
};

describe("monthlyRate", () => {
  it("(1 + r)^(1/12) − 1, po 12 miesiącach daje roczną stopę", () => {
    const rm = monthlyRate("0.03");
    expect(rm.plus(1).pow(12).minus(1).toDecimalPlaces(20).toString()).toBe("0.03");
    expect(rm.toFixed(10)).toBe("0.0024662698");
  });

  it("r = 0 daje dokładne zero", () => {
    expect(monthlyRate(0).isZero()).toBe(true);
  });

  it("odrzuca stopę ≤ −100%", () => {
    expect(() => monthlyRate(-1)).toThrow(RangeError);
  });
});

describe("futureValue", () => {
  it("przy r = 0 to PV + PMT × n", () => {
    expect(futureValue(1000, 250, 0, 12).toString()).toBe("4000");
  });

  it("n = 0 zwraca majątek startowy", () => {
    expect(futureValue("422870", "3500", monthlyRate("0.05"), 0).toString()).toBe("422870");
  });

  it("wpłata na koniec miesiąca: jeden miesiąc to PV × (1 + r_m) + PMT", () => {
    const rm = D("0.01");
    expect(futureValue(1000, 100, rm, 1).toString()).toBe("1110");
  });

  it("odrzuca ułamkową liczbę miesięcy", () => {
    expect(() => futureValue(1, 1, 0, 1.5)).toThrow(RangeError);
  });
});

describe("requiredCapital", () => {
  it("12 × (wydatki − ZUS) ÷ stopa wypłaty", () => {
    expect(requiredCapital(9000, 2500, "0.04").toString()).toBe("1950000");
  });

  it("ZUS ≥ wydatki: kapitał 0", () => {
    expect(requiredCapital(3000, 3200, "0.04").toString()).toBe("0");
  });

  it("stopa wypłaty musi być dodatnia", () => {
    expect(() => requiredCapital(1, 0, 0)).toThrow(RangeError);
  });
});

describe("calculateRetirement", () => {
  it("przykład z makiety: 63, 55 i 51 lat", () => {
    const res = calculateRetirement(mockup);
    expect(res.requiredCapital?.toString()).toBe("1950000");
    expect(res.scenarios.low.earliestAge).toBe(63);
    expect(res.scenarios.base.earliestAge).toBe(55);
    expect(res.scenarios.high.earliestAge).toBe(51);
    expect(res.scenarios.low.sufficient).toBe(false);
    expect(res.scenarios.base.sufficient).toBe(true);
    expect(res.scenarios.low.capitalAtRetirement.toFixed(2)).toBe("1793475.03");
  });

  it("seria od wieku obecnego do 80, co rok", () => {
    const { series } = calculateRetirement(mockup).scenarios.base;
    expect(series[0]).toEqual({ age: 34, capital: D("422870") });
    expect(series.at(-1)?.age).toBe(HORIZON_AGE);
    expect(series).toHaveLength(HORIZON_AGE - 34 + 1);
  });

  it("bez wpisanych wydatków liczy kapitał, ale nie wiek", () => {
    const res = calculateRetirement({ ...mockup, monthlySpending: null });
    expect(res.requiredCapital).toBeNull();
    expect(res.scenarios.base.earliestAge).toBeNull();
    expect(res.scenarios.base.sufficient).toBeNull();
    expect(res.scenarios.base.capitalAtRetirement.gt(0)).toBe(true);
  });

  it("już osiągnięty cel: najwcześniejszy wiek to wiek obecny", () => {
    const res = calculateRetirement({ ...mockup, startingCapital: "5000000" });
    expect(res.scenarios.low.earliestAge).toBe(34);
  });

  it("poza horyzontem: brak wieku", () => {
    const res = calculateRetirement({ ...mockup, startingCapital: 0, monthlyContribution: 100 });
    expect(res.scenarios.high.earliestAge).toBeNull();
    expect(res.scenarios.high.sufficient).toBe(false);
  });

  it("wyższa stopa nigdy nie daje późniejszego wieku", () => {
    const { scenarios } = calculateRetirement(mockup);
    expect(scenarios.high.capitalAtRetirement.gt(scenarios.base.capitalAtRetirement)).toBe(true);
    expect(scenarios.base.capitalAtRetirement.gt(scenarios.low.capitalAtRetirement)).toBe(true);
  });

  it("odrzuca błędne wieki i ujemne kwoty", () => {
    expect(() => calculateRetirement({ ...mockup, retireAge: 30 })).toThrow(RangeError);
    expect(() => calculateRetirement({ ...mockup, retireAge: 81 })).toThrow(RangeError);
    expect(() => calculateRetirement({ ...mockup, currentAge: 34.5 })).toThrow(RangeError);
    expect(() => calculateRetirement({ ...mockup, monthlyContribution: -1 })).toThrow(RangeError);
  });
});

describe("toNominal", () => {
  it("dolicza inflację składaną rocznie", () => {
    expect(toNominal(1000, "0.03", 2).toString()).toBe("1060.9");
    expect(toNominal(1000, "0.03", 0).toString()).toBe("1000");
  });
});

describe("zestaw referencyjny docs/referencje/emerytura.csv", () => {
  const csv = readFileSync(
    fileURLToPath(new URL("../../../docs/referencje/emerytura.csv", import.meta.url)),
    "utf8",
  );
  const [header, ...lines] = csv.trim().split(/\r?\n/);
  const cols = header.split(",");
  const rows = lines.map((line) => Object.fromEntries(line.split(",").map((v, i) => [cols[i], v])));

  it("ma co najmniej 8 przypadków", () => {
    expect(rows.length).toBeGreaterThanOrEqual(8);
  });

  const TOLERANCE = D("0.01");

  it.each(rows.map((r) => [r.id, r] as const))("%s zgadza się z pętlą miesięczną", (_id, row) => {
    const rate = row.stopa_zwrotu;
    const res = calculateRetirement({
      currentAge: Number(row.wiek),
      retireAge: Number(row.wiek_emerytalny),
      startingCapital: row.majatek_startowy,
      monthlyContribution: row.wplata_mies,
      monthlySpending: row.wydatki_mies,
      zusMonthly: row.zus_mies,
      withdrawalRate: row.stopa_wyplaty,
      returns: { low: rate, base: rate, high: rate },
      inflation: 0,
    });
    const s = res.scenarios.base;
    expect(res.requiredCapital!.minus(row.potrzebny_kapital).abs().lte(TOLERANCE)).toBe(true);
    expect(s.capitalAtRetirement.minus(row.kapital_w_wieku_emerytalnym).abs().lte(TOLERANCE)).toBe(true);
    expect(s.series.at(-1)!.capital.minus(row.kapital_w_80).abs().lte(TOLERANCE)).toBe(true);
    expect(s.sufficient).toBe(row.wystarcza === "tak");
    expect(s.earliestAge).toBe(row.najwczesniejszy_wiek === "" ? null : Number(row.najwczesniejszy_wiek));
  });
});
