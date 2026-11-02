import { describe, expect, it } from "vitest";
import { toMoneyString } from "@/lib/money";
import { depositMaturity, depositValueAt, type DepositInput } from "./deposit";

describe("lokata (SPEC 7.4)", () => {
  it("kapitalizacja miesięczna: 3 pełne okresy + 5 dni liniowo", () => {
    // 10 000 × (1 + 0,06/12)^3 × (1 + 0,06 × 5/365)
    // = 10 000 × 1,015075125 × 1,000821917808… = 10 150,75125 + 8,343083… = 10 159,094333… → 10 159,09
    const dep: DepositInput = {
      principal: 10_000,
      annualRate: "0.06",
      startDate: "2026-01-15",
      termMonths: 12,
      capitalization: "MONTHLY",
      autoRenew: false,
    };
    const v = depositValueAt(dep, "2026-04-20");
    expect(v.status).toBe("active");
    expect(toMoneyString(v.value)).toBe("10159.09");
  });

  it("kapitalizacja kwartalna od 31.01: granice okresów 30.04, 31.07, 31.10", () => {
    // n = 2 (30.04 i 31.07), 10 dni od 31.07 do 10.08:
    // 20 000 × 1,01² × (1 + 0,04 × 10/365) = 20 402 × 1,0010958904… = 20 402 + 22,358356… = 20 424,36
    const dep: DepositInput = {
      principal: 20_000,
      annualRate: "0.04",
      startDate: "2026-01-31",
      termMonths: 12,
      capitalization: "QUARTERLY",
      autoRenew: false,
    };
    expect(toMoneyString(depositValueAt(dep, "2026-08-10").value)).toBe("20424.36");
  });

  const halfYear: DepositInput = {
    principal: 10_000,
    annualRate: "0.05",
    startDate: "2026-03-01",
    termMonths: 6,
    capitalization: "END",
    autoRenew: false,
  };

  it("kapitalizacja na koniec: w trakcie liniowo, w terminie K × (1 + r·6/12)", () => {
    // 1.03 → 1.06 = 92 dni: 10 000 × (1 + 0,05 × 92/365) = 10 126,03
    expect(toMoneyString(depositValueAt(halfYear, "2026-06-01").value)).toBe("10126.03");
    // termin 1.09: 10 000 × 1,025 = 10 250
    expect(depositMaturity(halfYear)).toMatchObject({ date: "2026-09-01" });
    expect(depositMaturity(halfYear).amount.toString()).toBe("10250");
  });

  it("wzór SPEC daje skok w dniu terminu, gdy okres ma więcej niż 182,5 dnia", () => {
    // 31.08: 183 dni liniowo = 10 250,68 > 10 250 w terminie. Zapisane świadomie: wzór z SPEC 7.4
    // liczy pełne okresy jako r·k/12, a bieżący jako dni/365 (do decyzji właściciela, opis w README).
    expect(toMoneyString(depositValueAt(halfYear, "2026-08-31").value)).toBe("10250.68");
    expect(toMoneyString(depositValueAt(halfYear, "2026-09-01").value)).toBe("10250.00");
  });

  it("po terminie bez odnawiania: kwota z terminu bez dalszych odsetek, po przeniesieniu 0", () => {
    const after = depositValueAt(halfYear, "2026-10-15");
    expect(after.status).toBe("matured");
    expect(after.value.toString()).toBe("10250");
    const closed = depositValueAt({ ...halfYear, closedAt: "2026-09-01" }, "2026-09-01");
    expect(closed.status).toBe("closed");
    expect(closed.value.isZero()).toBe(true);
  });

  it("po terminie z odnawianiem: nowy okres od kwoty z terminu, flaga sprawdzenia stopy", () => {
    // 1.09 → 1.10 = 30 dni: 10 250 × (1 + 0,05 × 30/365) = 10 250 + 42,123287… = 10 292,12
    const v = depositValueAt({ ...halfYear, autoRenew: true }, "2026-10-01");
    expect(v).toMatchObject({ status: "active", termIndex: 1, termStart: "2026-09-01", checkRate: true });
    expect(v.maturityDate).toBe("2027-03-01");
    expect(toMoneyString(v.value)).toBe("10292.12");
  });

  it("przed założeniem wartość 0", () => {
    expect(depositValueAt(halfYear, "2026-02-28")).toMatchObject({ status: "notStarted" });
    expect(depositValueAt(halfYear, "2026-02-28").value.isZero()).toBe(true);
    expect(depositValueAt(halfYear, "2026-03-01").value.toString()).toBe("10000");
  });
});
