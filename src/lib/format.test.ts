import { describe, expect, it } from "vitest";
import { formatDate, formatMoney, formatNumber, formatPercent, warsawDateKey } from "./format";

// Intl używa twardych spacji jako separatora tysięcy; w testach normalizujemy do zwykłych.
const n = (s: string) => s.replace(/[  ]/g, " ");

describe("formatMoney", () => {
  it("formatuje złotówki po polsku", () => {
    expect(n(formatMoney("487320.15"))).toBe("487 320,15 zł");
  });
  it("nie traci precyzji przy dużych kwotach podanych jako napis", () => {
    expect(n(formatMoney("12345678901234.56"))).toBe("12 345 678 901 234,56 zł");
  });
  it("pokazuje znak i typograficzny minus", () => {
    expect(n(formatMoney(1204.3, "PLN", "pl", { signed: true }))).toBe("+1204,30 zł");
    expect(n(formatMoney(-555550.25))).toBe("−555 550,25 zł");
    expect(formatMoney(0, "PLN", "pl", { signed: true })).not.toMatch(/[+−]/);
  });
  it("obsługuje inne waluty i angielski", () => {
    expect(n(formatMoney("34751.68", "EUR"))).toBe("34 751,68 €");
    expect(formatMoney("1000", "USD", "en")).toBe("US$1,000.00");
  });
});

describe("formatPercent", () => {
  it("ułamek jako procent z przecinkiem", () => {
    expect(n(formatPercent(0.184))).toBe("18,4%");
    expect(n(formatPercent(-0.042, "pl", { signed: true }))).toBe("−4,2%");
    expect(n(formatPercent(0.0025, "pl", { signed: true, fractionDigits: 2 }))).toBe("+0,25%");
  });
});

describe("formatNumber", () => {
  it("ilości z częścią ułamkową", () => {
    expect(n(formatNumber("0.0712"))).toBe("0,0712");
    expect(n(formatNumber(262))).toBe("262");
  });
});

describe("daty w strefie Europe/Warsaw", () => {
  it("23:30 UTC 1 listopada to już 2 listopada w Warszawie", () => {
    const instant = new Date("2026-11-01T23:30:00Z");
    expect(warsawDateKey(instant)).toBe("2026-11-02");
    expect(formatDate(instant)).toBe("2.11.2026");
    expect(formatDate(instant, "pl", "long")).toBe("2 listopada 2026");
  });
  it("przejście na czas letni nie przesuwa daty", () => {
    expect(warsawDateKey(new Date("2026-03-29T00:30:00Z"))).toBe("2026-03-29");
  });
});
