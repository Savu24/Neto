import { describe, expect, it } from "vitest";
import { toMoneyString } from "@/lib/money";
import { netWorthAt, netWorthHistory, valueAccount, type AccountInput } from "./net-worth";
import { cashBalanceOn, positionValueAt, type PositionInput } from "./positions";

const fx = {
  EUR: [
    { date: "2026-10-30", rate: "4.2500" },
    { date: "2026-11-02", rate: "4.2648" },
  ],
};

const vwce: PositionInput = {
  id: "vwce",
  kind: "market",
  currency: "EUR",
  assetClass: "ETF",
  trades: [
    { type: "BUY", date: "2025-11-03", quantity: 100, price: "100.00", fxRate: "4.3990" },
    { type: "BUY", date: "2026-02-02", quantity: 100, price: "110.00", fxRate: "4.3966" },
    { type: "SELL", date: "2026-06-01", quantity: 38, price: "105.00", fxRate: "4.3500" },
    { type: "BUY", date: "2026-08-05", quantity: 100, price: "112.60", fxRate: "4.4000" },
  ],
  prices: [
    { date: "2026-10-30", close: "131.10" },
    { date: "2026-11-02", close: "132.64" },
  ],
};

const accounts: AccountInput[] = [
  {
    id: "rachunek",
    kind: "ASSET",
    positions: [
      { kind: "cash", currency: "PLN", assetClass: "CASH", flows: [{ date: "2026-01-01", amount: 10_000 }] },
    ],
  },
  { id: "ike", kind: "ASSET", positions: [vwce] },
  {
    id: "mieszkanie",
    kind: "ASSET",
    ownershipShare: "0.5",
    positions: [
      {
        kind: "manual",
        currency: "PLN",
        assetClass: "REAL_ESTATE",
        valuations: [
          { date: "2026-01-10", amount: 480_000 },
          { date: "2026-09-01", amount: 500_000 },
        ],
      },
    ],
  },
  {
    id: "hipoteka",
    kind: "LIABILITY",
    ownershipShare: "0.5",
    positions: [{ kind: "liability", currency: "PLN", balances: [{ date: "2026-10-15", amount: 300_000 }] }],
  },
  {
    id: "pominiete",
    kind: "ASSET",
    includeInNetWorth: false,
    positions: [{ kind: "cash", currency: "PLN", flows: [{ date: "2026-01-01", amount: 1_000_000 }] }],
  },
];

describe("wartość pozycji na dzień D (SPEC 7.3)", () => {
  it("gotówka: suma przepływów, korekta salda ustawia saldo", () => {
    const flows = [
      { date: "2026-01-01", amount: 1000 },
      { date: "2026-01-05", amount: -200 },
      { date: "2026-01-10", amount: 5000, set: true },
      { date: "2026-01-10", amount: 100 },
    ];
    expect(cashBalanceOn(flows, "2025-12-31").toString()).toBe("0");
    expect(cashBalanceOn(flows, "2026-01-07").toString()).toBe("800");
    expect(cashBalanceOn(flows, "2026-01-10").toString()).toBe("5100");
  });

  it("instrument: ilość × ostatnia cena ≤ D; cena z weekendu przeniesiona", () => {
    const sat = positionValueAt(vwce, "2026-10-31");
    expect(sat).toMatchObject({ sourceDate: "2026-10-30" });
    expect(sat.value!.toString()).toBe("34348.2"); // 262 × 131,10
  });

  it("instrument bez notowań: cena z ostatniej transakcji z oznaczeniem", () => {
    const v = positionValueAt(vwce, "2026-08-10");
    expect(v.priceFromTrade).toBe(true);
    expect(v.value!.toString()).toBe("29501.2"); // 262 × 112,60
  });

  it("instrument po sprzedaży całości ma wartość 0 mimo braku ceny", () => {
    const sold: PositionInput = {
      kind: "market",
      currency: "PLN",
      trades: [
        { type: "BUY", date: "2026-01-02", quantity: 5, price: 10 },
        { type: "SELL", date: "2026-02-02", quantity: 5, price: 12 },
      ],
      prices: [],
    };
    expect(positionValueAt(sold, "2026-03-01").value!.isZero()).toBe(true);
  });

  it("aktywo ręczne: funkcja schodkowa, przed pierwszą wyceną 0", () => {
    const flat = accounts[2].positions[0];
    expect(positionValueAt(flat, "2026-01-09").value!.isZero()).toBe(true);
    expect(positionValueAt(flat, "2026-08-31").value!.toString()).toBe("480000");
    expect(positionValueAt(flat, "2026-09-01").value!.toString()).toBe("500000");
  });
});

describe("wartość netto (SPEC 7.3)", () => {
  it("aktywa − zobowiązania, z kursem dnia i udziałem własności", () => {
    const nw = netWorthAt(accounts, "2026-11-02", fx);
    // 10 000 + 148 208,964864 + 0,5 × 500 000 = 408 208,964864; zobowiązania 0,5 × 300 000 = 150 000
    expect(nw.assets.toString()).toBe("408208.964864");
    expect(nw.liabilities.toString()).toBe("150000");
    expect(toMoneyString(nw.netWorth)).toBe("258208.96");
    expect(nw.byAccount.hipoteka.toString()).toBe("-150000");
    expect(nw.byAccount.pominiete).toBeUndefined();
    expect(Object.keys(nw.byCurrency).sort()).toEqual(["EUR", "PLN"]);
    expect(nw.byCurrency.PLN.toString()).toBe("260000");
    expect(nw.byClass.ETF.toString()).toBe("148208.964864");
    expect(nw.byClass.REAL_ESTATE.toString()).toBe("250000");
    expect(nw.staleCount).toBe(0);
  });

  it("kurs z dnia wolnego (niedziela, Wszystkich Świętych) to kurs z piątku", () => {
    const ike = valueAccount(accounts[1], "2026-11-01", fx);
    expect(ike.positions[0]).toMatchObject({ fxDate: "2026-10-30", sourceDate: "2026-10-30" });
    expect(ike.valuePln.toString()).toBe("145979.85"); // 262 × 131,10 × 4,25 = 34 348,20 × 4,25
  });

  it("ujemna wartość netto", () => {
    const nw = netWorthAt(
      [
        {
          id: "konto",
          kind: "ASSET",
          positions: [{ kind: "cash", currency: "PLN", flows: [{ date: "2026-01-01", amount: 1000 }] }],
        },
        {
          id: "kredyt",
          kind: "LIABILITY",
          positions: [
            { kind: "liability", currency: "PLN", balances: [{ date: "2026-10-20", amount: 50_000 }] },
          ],
        },
      ],
      "2026-11-02",
      {},
    );
    expect(nw.netWorth.toString()).toBe("-49000");
  });

  it("brak kursu: pozycja poza sumą i zgłoszona; nieaktualna cena liczona, ale zgłoszona", () => {
    const usd: AccountInput = {
      id: "usd",
      kind: "ASSET",
      positions: [{ kind: "cash", currency: "USD", flows: [{ date: "2026-01-01", amount: 100 }] }],
    };
    const stalePrice: AccountInput = {
      id: "stara-cena",
      kind: "ASSET",
      positions: [{ ...vwce, prices: [{ date: "2026-10-20", close: "130" }] } as PositionInput],
    };
    const nw = netWorthAt([usd, stalePrice], "2026-11-02", fx);
    expect(nw.accounts[0].complete).toBe(false);
    expect(nw.accounts[0].positions[0].issues).toEqual([{ type: "missingFx", currency: "USD" }]);
    expect(nw.accounts[1].positions[0].issues[0]).toMatchObject({
      type: "stale",
      staleness: { kind: "price", sourceDate: "2026-10-20", stale: true },
    });
    expect(nw.assets.toString()).toBe("145259.088"); // 262 × 130 × 4,2648
    expect(nw.staleCount).toBe(2);
  });

  it("aktywo ręczne po 90 dniach i saldo kredytu po 35 dniach są nieaktualne", () => {
    const nw = netWorthAt(accounts, "2026-12-15", fx);
    // mieszkanie: 1.09 → 15.12 = 105 dni; hipoteka: 15.10 → 15.12 = 61 dni
    const issues = nw.accounts.flatMap((a) => a.positions.flatMap((p) => p.issues.map((i) => i.type)));
    expect(issues.filter((t) => t === "stale")).toHaveLength(4); // + cena VWCE i kurs EUR z 2.11
    expect(nw.staleCount).toBe(3);
  });

  it("udział własności spoza 0–1 to błąd", () => {
    expect(() =>
      valueAccount({ id: "x", kind: "ASSET", ownershipShare: 0, positions: [] }, "2026-11-02", fx),
    ).toThrow(RangeError);
  });

  it("historia dzień po dniu", () => {
    const h = netWorthHistory(accounts, "2026-10-30", "2026-11-02", fx);
    expect(h.map((p) => p.date)).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(h[1].netWorth.eq(h[2].netWorth)).toBe(true);
  });
});
