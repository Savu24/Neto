import { describe, expect, it } from "vitest";
import {
  canonicalRows,
  headerSignature,
  parseTypeWord,
  rowsToDrafts,
  suggestColumns,
  suggestMapping,
  type Draft,
} from "./mapping";

const today = "2026-11-03";

describe("mapowanie kolumn", () => {
  it("rozpoznaje typowe nagłówki banków i brokerów", () => {
    expect(suggestColumns(["Data operacji", "Opis operacji", "Kwota", "Waluta"])).toEqual({
      date: "Data operacji",
      description: "Opis operacji",
      amount: "Kwota",
      currency: "Waluta",
    });
    expect(suggestColumns(["Data", "Typ", "Ticker", "Ilość", "Cena", "Prowizja"])).toEqual({
      date: "Data",
      type: "Typ",
      symbol: "Ticker",
      quantity: "Ilość",
      price: "Cena",
      fee: "Prowizja",
    });
  });

  it("proponuje formaty z danych", () => {
    const m = suggestMapping(["Date", "Amount"], [["2026-11-02", "1,234.50"]]);
    expect(m.dateFormat).toBe("YMD");
    expect(m.numberFormat).toBe("dot");
  });

  it("podpis nagłówka nie zależy od wielkości liter", () => {
    expect(headerSignature(["Data", "Kwota"])).toBe(headerSignature(["DATA", "kwota "]));
  });

  it("słowa typu operacji", () => {
    expect(parseTypeWord("Kupno")).toBe("BUY");
    expect(parseTypeWord("K")).toBe("BUY");
    expect(parseTypeWord("SPRZEDAŻ")).toBe("SELL");
    expect(parseTypeWord("Dywidenda pieniężna")).toBe("DIVIDEND");
    expect(parseTypeWord("Wypłata")).toBe("WITHDRAWAL");
    expect(parseTypeWord("Przelew na telefon")).toBeNull();
  });
});

describe("wiersze → transakcje", () => {
  const bank = {
    columns: { date: "Data", amount: "Kwota", description: "Opis" },
    dateFormat: "DMY" as const,
    numberFormat: "comma" as const,
  };

  it("wyciąg bankowy: znak kwoty decyduje o wpłacie/wypłacie", () => {
    const res = rowsToDrafts(
      ["Data", "Opis", "Kwota"],
      [
        ["02.11.2026", "Kawa", "-12,50"],
        ["01.11.2026", "Pensja", "8 000,00"],
      ],
      bank,
      { accountType: "CHECKING", today },
    );
    expect(res).toMatchObject([
      { line: 2, ok: true, draft: { type: "WITHDRAWAL", amount: "-12.5", date: "2026-11-02", note: "Kawa" } },
      { line: 3, ok: true, draft: { type: "DEPOSIT", amount: "8000" } },
    ]);
  });

  it("błędy w wierszach: data, przyszłość, kwota, zero", () => {
    const res = rowsToDrafts(
      ["Data", "Opis", "Kwota"],
      [
        ["", "x", "1"],
        ["32.01.2026", "x", "1"],
        ["04.11.2026", "x", "1"],
        ["01.11.2026", "x", "abc"],
        ["01.11.2026", "x", "0,00"],
      ],
      bank,
      { accountType: "CHECKING", today },
    );
    expect(res.map((r) => (r.ok ? "ok" : r.error))).toEqual([
      "missingDate",
      "badDate",
      "futureDate",
      "badAmount",
      "zeroAmount",
    ]);
  });

  it("broker: kupno z ceną i prowizją, sprzedaż z kwoty", () => {
    const res = rowsToDrafts(
      ["Data", "Typ", "Ticker", "Ilość", "Cena", "Prowizja", "Kwota"],
      [
        ["2026-10-01", "Kupno", "pko", "10", "50,00", "5,00", ""],
        ["2026-10-02", "S", "PKO", "4", "", "2,00", "238,00"],
      ],
      {
        columns: {
          date: "Data",
          type: "Typ",
          symbol: "Ticker",
          quantity: "Ilość",
          price: "Cena",
          fee: "Prowizja",
          amount: "Kwota",
        },
        dateFormat: "YMD",
        numberFormat: "comma",
      },
      { accountType: "BROKERAGE", today },
    );
    expect(res[0]).toMatchObject({
      ok: true,
      draft: { type: "BUY", symbol: "PKO", quantity: "10", price: "50", fee: "5", amount: "-505" },
    });
    // 238 + 2 prowizji = 240 brutto → 60 zł za sztukę; na rachunek wpływa 238
    expect(res[1]).toMatchObject({ ok: true, draft: { type: "SELL", price: "60", amount: "238" } });
  });

  it("kupno na rachunku bankowym jest niedozwolone; brak tickera to błąd", () => {
    const cols = {
      columns: { date: "D", type: "T", amount: "A", symbol: "S", quantity: "Q", price: "P" },
      dateFormat: "YMD" as const,
      numberFormat: "dot" as const,
    };
    const h = ["D", "T", "A", "S", "Q", "P"];
    expect(
      rowsToDrafts(h, [["2026-10-01", "buy", "-10", "X", "1", "10"]], cols, {
        accountType: "SAVINGS",
        today,
      })[0],
    ).toMatchObject({
      ok: false,
      error: "typeNotAllowed",
    });
    expect(
      rowsToDrafts(h, [["2026-10-01", "buy", "-10", "", "1", "10"]], cols, {
        accountType: "BROKERAGE",
        today,
      })[0],
    ).toMatchObject({
      ok: false,
      error: "missingSymbol",
    });
  });

  it("odciski: identyczne wiersze w pliku różnią się numerem wystąpienia", () => {
    const d: Draft = {
      date: "2026-11-02",
      type: "WITHDRAWAL",
      amount: "-12.5",
      quantity: null,
      price: null,
      fee: null,
      currency: "PLN",
      symbol: null,
      note: "Kawa",
    };
    const [a, b, c] = canonicalRows([d, d, { ...d, amount: "-13" }]);
    expect(a).not.toBe(b);
    expect(a.endsWith("#1")).toBe(true);
    expect(b.endsWith("#2")).toBe(true);
    expect(c.endsWith("#1")).toBe(true);
    // ponowny import tego samego pliku daje te same odciski
    expect(canonicalRows([d, d])).toEqual([a, b]);
  });
});
