import { describe, expect, it } from "vitest";
import { CsvError, MAX_FILE_BYTES, decode, detectDelimiter, parseCsv, readCsv } from "./csv";
import { detectDateFormat, detectNumberFormat, parseDate, parseNumber, parseUserNumber } from "./numbers";

const utf8 = (s: string) => new TextEncoder().encode(s);

/** Ręczne kodowanie Windows-1250 polskich liter (TextEncoder zna tylko UTF-8). */
const CP1250: Record<string, number> = {
  ą: 0xb9,
  ć: 0xe6,
  ę: 0xea,
  ł: 0xb3,
  ń: 0xf1,
  ó: 0xf3,
  ś: 0x9c,
  ź: 0x9f,
  ż: 0xbf,
  Ą: 0xa5,
  Ć: 0xc6,
  Ę: 0xca,
  Ł: 0xa3,
  Ń: 0xd1,
  Ó: 0xd3,
  Ś: 0x8c,
  Ź: 0x8f,
  Ż: 0xaf,
};
const cp1250 = (s: string) => Uint8Array.from([...s].map((ch) => CP1250[ch] ?? ch.charCodeAt(0)));

describe("liczby (HU-2.4)", () => {
  it("format polski i angielski", () => {
    expect(parseNumber("1 234,56", "comma")).toBe("1234.56");
    expect(parseNumber("1 234,56 zł", "comma")).toBe("1234.56");
    expect(parseNumber("1.234,56", "comma")).toBe("1234.56");
    expect(parseNumber("1,234.56", "dot")).toBe("1234.56");
    expect(parseNumber("-1,234.56 USD", "dot")).toBe("-1234.56");
    expect(parseNumber("−12,30", "comma")).toBe("-12.3");
    expect(parseNumber("(12.30)", "dot")).toBe("-12.3");
    expect(parseNumber("12,30-", "comma")).toBe("-12.3");
    expect(parseNumber("+0,5", "comma")).toBe("0.5");
  });

  it("odrzuca to, co nie jest liczbą", () => {
    expect(parseNumber("", "comma")).toBeNull();
    expect(parseNumber("abc", "comma")).toBeNull();
    expect(parseNumber("1,2,3", "comma")).toBeNull();
    expect(parseNumber("12.3.4", "dot")).toBeNull();
  });

  it("rozpoznaje format kolumny z próbek", () => {
    expect(detectNumberFormat(["1 234,56", "-12,00"])).toBe("comma");
    expect(detectNumberFormat(["1,234.56", "-12.00"])).toBe("dot");
    expect(detectNumberFormat(["1,234,567", "5"])).toBe("dot");
    expect(detectNumberFormat(["1.234.567", "5"])).toBe("comma");
    // jeden separator przed trzema cyframi nic nie rozstrzyga: domyślnie polski
    expect(detectNumberFormat(["1,234"])).toBe("comma");
    expect(detectNumberFormat(["10.5", "3.25"])).toBe("dot");
  });

  it("liczby wpisane w formularzu", () => {
    expect(parseUserNumber("1 234,5")).toBe("1234.5");
    expect(parseUserNumber("1,234.5")).toBe("1234.5");
    expect(parseUserNumber("1234.5")).toBe("1234.5");
    expect(parseUserNumber("0,0712")).toBe("0.0712");
  });
});

describe("daty", () => {
  it("formaty i walidacja", () => {
    expect(parseDate("2026-11-02", "YMD")).toBe("2026-11-02");
    expect(parseDate("2026-11-02 14:31:00", "YMD")).toBe("2026-11-02");
    expect(parseDate("02.11.2026", "DMY")).toBe("2026-11-02");
    expect(parseDate("2/11/2026", "DMY")).toBe("2026-11-02");
    expect(parseDate("11/02/2026", "MDY")).toBe("2026-11-02");
    expect(parseDate("31.02.2026", "DMY")).toBeNull();
    expect(parseDate("02.11.26", "DMY")).toBeNull();
    expect(parseDate("2026-11-02", "DMY")).toBeNull();
  });

  it("rozpoznaje format z próbek", () => {
    expect(detectDateFormat(["2026-01-05"])).toBe("YMD");
    expect(detectDateFormat(["05.01.2026", "28.01.2026"])).toBe("DMY");
    expect(detectDateFormat(["01/28/2026"])).toBe("MDY");
  });
});

describe("CSV", () => {
  it("cudzysłowy, separator w polu, nowa linia w polu, CRLF", () => {
    const text = 'a;b;c\r\n"x;y";"z ""cytat""";"dwie\nlinie"\r\n1;2;3\r\n';
    expect(parseCsv(text, ";")).toEqual([
      ["a", "b", "c"],
      ["x;y", 'z "cytat"', "dwie\nlinie"],
      ["1", "2", "3"],
    ]);
  });

  it("rozpoznaje separator", () => {
    expect(detectDelimiter("a;b;c\n1;2,5;3\n")).toBe(";");
    expect(detectDelimiter("a,b,c\n1,2.5,3\n")).toBe(",");
    expect(detectDelimiter("a\tb\tc\n1\t2\t3\n")).toBe("\t");
  });

  it("kodowanie: UTF-8 z BOM i Windows-1250", () => {
    expect(decode(utf8("﻿Zażółć")).text.replace(/^﻿/, "")).toBe("Zażółć");
    const w = decode(cp1250("Opis;Kwota\nWpłata za żółtą łódź;12,00"));
    expect(w.encoding).toBe("windows-1250");
    expect(w.text).toContain("Wpłata za żółtą łódź");
  });

  it("pomija metryczkę banku nad nagłówkiem i puste wiersze", () => {
    const file = readCsv(
      utf8(
        "Wyciąg z rachunku\nKlient: Jan\n\nData;Opis;Kwota\n02.11.2026;Kawa;-12,50\n\n03.11.2026;Pensja;8 000,00\n",
      ),
    );
    expect(file.headers).toEqual(["Data", "Opis", "Kwota"]);
    expect(file.rows).toHaveLength(2);
    expect(file.lines).toEqual([5, 7]);
    expect(file.delimiter).toBe(";");
  });

  it("nazwy kolumn są unikalne i niepuste", () => {
    const file = readCsv(utf8("Kwota;;Kwota\n1;2;3\n"));
    expect(file.headers).toEqual(["Kwota", "#2", "Kwota (2)"]);
  });

  it("limity: 5 MB i pusty plik", () => {
    expect(() => readCsv(new Uint8Array(MAX_FILE_BYTES + 1))).toThrow(CsvError);
    expect(() => readCsv(utf8("   \n"))).toThrow(CsvError);
    expect(() => readCsv(utf8("Data;Kwota\n"))).toThrow(CsvError);
  });
});
