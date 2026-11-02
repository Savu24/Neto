import { describe, expect, it } from "vitest";
import { D, toMoneyString } from "@/lib/money";
import { applyFifo, InsufficientQuantityError, quantityOn, type TradeInput } from "./fifo";
import { MissingFxRateError, fxRateOn } from "./fx";
import { positionResult } from "./result";

/**
 * Makieta `docs/mockups/pozycja.html` (VWCE, IKE): 262 szt. × 132,64 EUR × 4,2648 = 148 208,96 zł,
 * koszt FIFO 125 180,40 zł (28 460,00 EUR), wynik +23 028,56 zł = zmiana ceny +26 832,76 − efekt walutowy 3 804,19.
 * Makieta nie podaje wszystkich 31 transakcji, więc partie dobrane tak, żeby dały te same sumy:
 *   62 × 100,00 EUR po 4,3990 (reszta partii 100 szt. po sprzedaży 38) = 6 200,00 EUR = 27 273,80 zł
 *  100 × 110,00 EUR po 4,3966                                         = 11 000,00 EUR = 48 362,60 zł
 *  100 × 112,60 EUR po 4,4000                                         = 11 260,00 EUR = 49 544,00 zł
 *                                                              razem    28 460,00 EUR = 125 180,40 zł
 */
const vwce: TradeInput[] = [
  { id: "t1", type: "BUY", date: "2025-11-03", quantity: 100, price: "100.00", fxRate: "4.3990" },
  { id: "t2", type: "BUY", date: "2026-02-02", quantity: 100, price: "110.00", fxRate: "4.3966" },
  { id: "t3", type: "SELL", date: "2026-06-01", quantity: 38, price: "105.00", fxRate: "4.3500" },
  { id: "t4", type: "BUY", date: "2026-08-05", quantity: 100, price: "112.60", fxRate: "4.4000" },
];

describe("FIFO i wynik pozycji — przykład z makiety", () => {
  const { lots, sales } = applyFifo(vwce, { currency: "EUR" });
  const r = positionResult({ lots, price: "132.64", fxRate: "4.2648" });

  it("partie po sprzedaży zdejmują najstarsze jednostki", () => {
    expect(lots.map((l) => [l.tradeId, l.remaining.toString()])).toEqual([
      ["t1", "62"],
      ["t2", "100"],
      ["t4", "100"],
    ]);
  });

  it("wartość, koszt i składniki wyniku", () => {
    expect(r.quantity.toString()).toBe("262");
    expect(r.value.toString()).toBe("34751.68");
    expect(toMoneyString(r.valuePln)).toBe("148208.96");
    expect(r.cost.toString()).toBe("28460");
    expect(toMoneyString(r.costPln)).toBe("125180.40");
    expect(toMoneyString(r.averageCost!)).toBe("108.63");
    expect(toMoneyString(r.totalPln)).toBe("23028.56");
    expect(toMoneyString(r.priceEffectPln)).toBe("26832.76");
    expect(toMoneyString(r.fxEffectPln)).toBe("-3804.19");
    expect(r.totalPercent!.toFixed(3)).toBe("0.184");
  });

  it("zmiana ceny + efekt walutowy = wynik całkowity (dokładnie)", () => {
    expect(r.priceEffectPln.plus(r.fxEffectPln).eq(r.totalPln)).toBe(true);
    expect(r.totalPln.toString()).toBe("23028.564864");
  });

  it("wynik zrealizowany zapisany przy sprzedaży", () => {
    // 38 × 105 EUR = 3 990 EUR × 4,35 = 17 356,50 zł; koszt 38 × 100 EUR × 4,399 = 16 716,20 zł.
    expect(sales).toHaveLength(1);
    expect(sales[0]).toMatchObject({ tradeId: "t3", date: "2026-06-01" });
    expect(sales[0].realized.toString()).toBe("190");
    expect(sales[0].proceedsPln.toString()).toBe("17356.5");
    expect(sales[0].costPln.toString()).toBe("16716.2");
    expect(sales[0].realizedPln.toString()).toBe("640.3");
  });

  it("stan na dzień przed ostatnim kupnem (upTo)", () => {
    const before = applyFifo(vwce, { currency: "EUR", upTo: "2026-08-04" });
    expect(before.lots.reduce((a, l) => a.plus(l.remaining), D(0)).toString()).toBe("162");
    expect(quantityOn(vwce, "2026-08-04").toString()).toBe("162");
    expect(quantityOn(vwce, "2026-08-05").toString()).toBe("262");
    expect(quantityOn(vwce, "2025-01-01").toString()).toBe("0");
  });
});

describe("FIFO — przypadki brzegowe", () => {
  it("sprzedaż całej pozycji: brak partii, wynik niezrealizowany 0, procent pusty", () => {
    const trades: TradeInput[] = [
      { type: "BUY", date: "2026-01-10", quantity: 10, price: 50, fee: 5 },
      { type: "SELL", date: "2026-03-10", quantity: 10, price: 60, fee: 5 },
    ];
    const { lots, sales } = applyFifo(trades, { currency: "PLN" });
    expect(lots).toHaveLength(0);
    // (10 × 60 − 5) − (10 × 50 + 5) = 595 − 505 = 90
    expect(sales[0].realizedPln.toString()).toBe("90");
    const r = positionResult({ lots, price: 70, fxRate: 1 });
    expect(r.quantity.isZero()).toBe(true);
    expect(r.totalPln.isZero()).toBe(true);
    expect(r.averageCost).toBeNull();
    expect(r.totalPercent).toBeNull();
  });

  it("sprzedaż ponad posiadaną ilość podaje dostępną ilość", () => {
    const trades: TradeInput[] = [
      { type: "BUY", date: "2026-01-10", quantity: 10, price: 50 },
      { type: "SELL", date: "2026-02-10", quantity: 11, price: 60 },
    ];
    expect(() => applyFifo(trades, { currency: "PLN" })).toThrow(InsufficientQuantityError);
    try {
      applyFifo(trades, { currency: "PLN" });
    } catch (e) {
      expect((e as InsufficientQuantityError).available.toString()).toBe("10");
    }
  });

  it("kupno i sprzedaż tego samego dnia działa niezależnie od kolejności wpisu", () => {
    const trades: TradeInput[] = [
      { type: "SELL", date: "2026-01-10", quantity: 5, price: 52 },
      { type: "BUY", date: "2026-01-10", quantity: 5, price: 50 },
    ];
    const { lots, sales } = applyFifo(trades, { currency: "PLN" });
    expect(lots).toHaveLength(0);
    expect(sales[0].realizedPln.toString()).toBe("10");
  });

  it("kurs z dnia wolnego: kupno w sobotę bierze kurs z piątku", () => {
    const fx = {
      EUR: [
        { date: "2026-10-30", rate: "4.2500" },
        { date: "2026-11-02", rate: "4.2648" },
      ],
    };
    expect(fxRateOn(fx, "EUR", "2026-10-31")).toEqual({ rate: D("4.25"), date: "2026-10-30" });
    const { lots } = applyFifo([{ type: "BUY", date: "2026-10-31", quantity: 2, price: 100 }], {
      currency: "EUR",
      fx,
    });
    expect(lots[0].fxRate.toString()).toBe("4.25");
    // Kurs z transakcji (np. brokera) wygrywa z tabelą NBP.
    const own = applyFifo([{ type: "BUY", date: "2026-10-31", quantity: 2, price: 100, fxRate: "4.30" }], {
      currency: "EUR",
      fx,
    });
    expect(own.lots[0].fxRate.toString()).toBe("4.3");
  });

  it("brak kursu dla waluty obcej to błąd, nie cichy kurs 1", () => {
    expect(() =>
      applyFifo([{ type: "BUY", date: "2026-10-31", quantity: 1, price: 1 }], { currency: "USD" }),
    ).toThrow(MissingFxRateError);
  });

  it("prowizja kupna wchodzi w koszt jednostkowy", () => {
    const { lots } = applyFifo([{ type: "BUY", date: "2026-01-10", quantity: 4, price: 25, fee: 2 }], {
      currency: "PLN",
    });
    expect(lots[0].unitCost.toString()).toBe("25.5");
  });
});
