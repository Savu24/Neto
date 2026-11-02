import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { dictionaries, locales, negotiateLocale } from "./config";
import { createTranslator, interpolate } from "./translate";

const dir = path.join(__dirname, "dictionaries");

describe("słowniki", () => {
  it("każdy język ma te same pliki zakresów", () => {
    const [first, ...rest] = locales.map((l) => readdirSync(path.join(dir, l)).sort());
    for (const files of rest) expect(files).toEqual(first);
  });

  it("każdy zakres ma te same klucze w obu językach i żadnej pustej wartości", () => {
    for (const scope of Object.keys(dictionaries.pl) as (keyof typeof dictionaries.pl)[]) {
      const plKeys = Object.keys(dictionaries.pl[scope]).sort();
      const enKeys = Object.keys(dictionaries.en[scope]).sort();
      expect(enKeys, scope).toEqual(plKeys);
      for (const l of locales) {
        for (const [k, v] of Object.entries(dictionaries[l][scope] as Record<string, string>)) {
          expect(v.trim(), `${l}/${scope}.${k}`).not.toBe("");
        }
      }
    }
  });

  it("rejestr obejmuje wszystkie pliki JSON", () => {
    const files = readdirSync(path.join(dir, "pl")).map((f) => f.replace(/\.json$/, ""));
    expect(Object.keys(dictionaries.pl).sort()).toEqual(files.sort());
  });

  it("polskie teksty używają cudzysłowów „”, nie prostych", () => {
    const raw = readdirSync(path.join(dir, "pl")).map((f) => readFileSync(path.join(dir, "pl", f), "utf8"));
    for (const text of raw) expect(text).not.toMatch(/"[^"]*\\"[^"]*"/);
  });
});

describe("negotiateLocale", () => {
  it("ciasteczko ma pierwszeństwo", () => {
    expect(negotiateLocale("en", "pl-PL,pl;q=0.9")).toBe("en");
  });
  it("wybiera najlepiej oceniony obsługiwany język z nagłówka", () => {
    expect(negotiateLocale(undefined, "de-DE,de;q=0.9,en;q=0.8,pl;q=0.5")).toBe("en");
  });
  it("domyślnie polski, także przy śmieciach w ciasteczku", () => {
    expect(negotiateLocale("xx", null)).toBe("pl");
    expect(negotiateLocale(undefined, "fr-FR")).toBe("pl");
  });
});

describe("createTranslator", () => {
  it("tłumaczy i wstawia parametry", () => {
    expect(createTranslator("pl", "nav")("dashboard")).toBe("Pulpit");
    expect(createTranslator("en", "nav")("dashboard")).toBe("Dashboard");
    expect(interpolate("Masz {n} pozycji", { n: 3 })).toBe("Masz 3 pozycji");
    expect(interpolate("Brak {x}", {})).toBe("Brak {x}");
  });
});
