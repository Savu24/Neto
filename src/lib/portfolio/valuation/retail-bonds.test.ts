import { describe, expect, it } from "vitest";
import { toMoneyString } from "@/lib/money";
import {
  parseRetailBondSeries,
  retailBondCouponsTotal,
  retailBondMaturityDate,
  retailBondValueAt,
  type RetailBondInput,
} from "./retail-bonds";

/**
 * Oczekiwane wyniki policzone ręcznie ze wzorów SPEC 7.5 (kroki w komentarzach).
 * Stopy dla kolejnych okresów są przykładowe (nie z listów emisyjnych). Porównania z kalkulatorem
 * obligacjeskarbowe.pl NIE zrobiono — do sprawdzenia (różnice groszowe przez zaokrąglenia emitenta).
 */

describe("obligacje kapitalizujące", () => {
  const edo: RetailBondInput = {
    type: "EDO",
    count: 10,
    purchaseDate: "2024-03-15",
    periodRates: ["0.068", "0.045", "0.056"],
  };

  it("EDO w trzecim roku", () => {
    // Pełne lata: 15.03.2025, 15.03.2026 → baza = 100 × 1,068 × 1,045 = 111,606
    // Rok obligacji 15.03.2026–15.03.2027 = 365 dni; od 15.03 do 1.07.2026 = 16 + 30 + 31 + 30 + 1 = 108 dni
    // narosłe = 111,606 × 0,056 × 108/365 = 6,249936 × 108/365 = 1,849296…
    // 1 szt. = 113,455296…; 10 szt. = 1 134,55
    const v = retailBondValueAt(edo, "2026-07-01");
    expect(v).toMatchObject({
      status: "active",
      periodIndex: 2,
      periodStart: "2026-03-15",
      periodEnd: "2027-03-15",
    });
    expect(toMoneyString(v.perBond)).toBe("113.46");
    expect(toMoneyString(v.value)).toBe("1134.55");
    expect(v.rateMissing).toBe(false);
  });

  it("brak stopy na kolejny rok: ostatnia znana + oznaczenie; rok przestępny ma 366 dni", () => {
    // Rok 4: 15.03.2027–15.03.2028 = 366 dni (29.02.2028). Baza = 111,606 × 1,056 = 117,855936
    // 15.03 → 15.09.2027 = 184 dni; narosłe = 117,855936 × 0,056 × 184/366 = 3,318…; 1 szt. = 121,17
    const v = retailBondValueAt(edo, "2027-09-15");
    expect(v.periodIndex).toBe(3);
    expect(v.rateMissing).toBe(true);
    expect(toMoneyString(v.perBond)).toBe("121.17");
  });

  const tos: RetailBondInput = { type: "TOS", count: 5, purchaseDate: "2025-01-10", periodRates: ["0.0655"] };

  it("TOS: stała stopa we wszystkich latach, wykup po 3 latach", () => {
    // 10.01.2027 = dokładnie 2 lata: 100 × 1,0655² = 113,529025; 5 szt. = 567,645125 → 567,65
    expect(toMoneyString(retailBondValueAt(tos, "2027-01-10").value)).toBe("567.65");
    expect(retailBondValueAt(tos, "2027-01-10").rateMissing).toBe(false);
    // wykup 10.01.2028: 100 × 1,0655³ = 120,9651761375; 5 szt. = 604,8258806875 → 604,83
    const atMaturity = retailBondValueAt(tos, "2028-01-10");
    expect(atMaturity.status).toBe("matured");
    expect(toMoneyString(atMaturity.value)).toBe("604.83");
    // po terminie bez dalszych odsetek, aż do przeniesienia środków
    expect(retailBondValueAt(tos, "2028-03-01").value.eq(atMaturity.value)).toBe(true);
    expect(retailBondValueAt({ ...tos, redeemedAt: "2028-01-10" }, "2028-03-01").value.isZero()).toBe(true);
  });

  it("ROS i ROD: terminy 6 i 12 lat", () => {
    expect(retailBondMaturityDate({ type: "ROS", purchaseDate: "2026-02-01" })).toBe("2032-02-01");
    expect(retailBondMaturityDate({ type: "ROD", purchaseDate: "2026-02-01" })).toBe("2038-02-01");
    // ROS po roku i pół miesiąca: 100 × 1,0675 × (1 + 0,0705 × 14/365)
    // 1.02.2027 → 15.02.2027 = 14 dni; rok 1.02.2027–1.02.2028 = 365 dni
    // = 106,75 × 1,002704109… = 107,038664…; 3 szt. = 321,12
    const ros: RetailBondInput = {
      type: "ROS",
      count: 3,
      purchaseDate: "2026-02-01",
      periodRates: ["0.0675", "0.0705"],
    };
    expect(toMoneyString(retailBondValueAt(ros, "2027-02-15").value)).toBe("321.12");
  });
});

describe("OTS (odsetki przy wykupie)", () => {
  const ots: RetailBondInput = { type: "OTS", count: 20, purchaseDate: "2026-01-05", periodRates: ["0.03"] };

  it("w trakcie i w terminie", () => {
    // 5.01 → 5.03 = 31 + 28 = 59 dni: 100 × (1 + 0,03 × 59/365) = 100,484931…; 20 szt. = 2 009,70
    expect(toMoneyString(retailBondValueAt(ots, "2026-03-05").value)).toBe("2009.70");
    // termin 5.04 = 90 dni: 100 + 3 × 90/365 = 100,739726…; 20 szt. = 2 014,79
    expect(retailBondMaturityDate(ots)).toBe("2026-04-05");
    expect(toMoneyString(retailBondValueAt(ots, "2026-04-05").value)).toBe("2014.79");
    expect(toMoneyString(retailBondValueAt(ots, "2026-05-01").value)).toBe("2014.79");
  });
});

describe("obligacje kuponowe", () => {
  const coi: RetailBondInput = {
    type: "COI",
    count: 50,
    purchaseDate: "2024-06-20",
    periodRates: ["0.065", "0.053", "0.041"],
  };

  it("COI z dwoma wypłaconymi kuponami i narosłym trzecim", () => {
    // Kupony: 20.06.2025: 50 × 100 × 0,065 = 325; 20.06.2026: 50 × 100 × 0,053 = 265
    // Okres 3: 20.06.2026–20.06.2027 = 365 dni; do 1.09.2026 = 10 + 31 + 31 + 1 = 73 dni (= 0,2 roku)
    // narosłe na 1 szt. = 100 × 0,041 × 73/365 = 0,82; wartość = 50 × 100,82 = 5 041,00
    const v = retailBondValueAt(coi, "2026-09-01");
    expect(v.coupons.map((c) => [c.date, c.amount.toString()])).toEqual([
      ["2025-06-20", "325"],
      ["2026-06-20", "265"],
    ]);
    expect(retailBondCouponsTotal(v).toString()).toBe("590");
    expect(v.accrued.toString()).toBe("41");
    expect(v.value.toString()).toBe("5041");
  });

  it("w dniu wypłaty kuponu wartość wraca do nominału", () => {
    const v = retailBondValueAt(coi, "2026-06-20");
    expect(v.value.toString()).toBe("5000");
    expect(v.coupons).toHaveLength(2);
  });

  it("wykup COI: ostatni kupon w dniu terminu, wartość = nominał", () => {
    const v = retailBondValueAt({ ...coi, periodRates: ["0.065", "0.053", "0.041", "0.04"] }, "2028-06-20");
    expect(v.status).toBe("matured");
    expect(v.coupons).toHaveLength(4);
    expect(v.coupons[3].amount.toString()).toBe("200");
    expect(v.value.toString()).toBe("5000");
  });

  it("wykup przedterminowy: wartość 0 i brak kolejnych kuponów", () => {
    const v = retailBondValueAt({ ...coi, redeemedAt: "2025-12-01" }, "2026-09-01");
    expect(v.status).toBe("redeemed");
    expect(v.value.isZero()).toBe(true);
    expect(v.coupons).toHaveLength(1);
  });

  it("ROR: kupon miesięczny, okresy od 31.01 przycinane do końca miesiąca", () => {
    // Okres 1: 31.01–28.02, kupon = 100 szt. × 100 × 0,0575/12 = 47,916…
    // Okres 2: 28.02–31.03 = 31 dni; do 15.03 = 15 dni; narosłe na 1 szt. = 100 × 0,055/12 × 15/31 = 0,221774…
    // wartość = 100 × 100,221774… = 10 022,18
    const ror: RetailBondInput = {
      type: "ROR",
      count: 100,
      purchaseDate: "2026-01-31",
      periodRates: ["0.0575", "0.055"],
    };
    const v = retailBondValueAt(ror, "2026-03-15");
    expect(v).toMatchObject({ periodIndex: 1, periodStart: "2026-02-28", periodEnd: "2026-03-31" });
    expect(toMoneyString(v.coupons[0].amount)).toBe("47.92");
    expect(toMoneyString(v.value)).toBe("10022.18");
  });

  it("DOR: termin 2 lata, przed zakupem 0", () => {
    const dor: RetailBondInput = {
      type: "DOR",
      count: 1,
      purchaseDate: "2026-05-10",
      periodRates: ["0.058"],
    };
    expect(retailBondMaturityDate(dor)).toBe("2028-05-10");
    expect(retailBondValueAt(dor, "2026-05-09")).toMatchObject({ status: "notStarted" });
    expect(retailBondValueAt(dor, "2026-05-10").value.toString()).toBe("100");
  });
});

describe("seria obligacji", () => {
  it("rozpoznaje typ i miesiąc wykupu", () => {
    expect(parseRetailBondSeries("EDO1126")).toEqual({ type: "EDO", maturityMonth: "2026-11" });
    expect(parseRetailBondSeries("coi0628")).toEqual({ type: "COI", maturityMonth: "2028-06" });
    expect(parseRetailBondSeries("XYZ1126")).toBeNull();
    expect(parseRetailBondSeries("EDO1326")).toBeNull();
  });
});
