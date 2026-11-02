import { describe, expect, it, vi } from "vitest";
import { carryForwardRates, createNbpFxProvider } from "./nbp";
import { PricingError, type FetchFn } from "./types";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const eurRates = {
  table: "A",
  currency: "euro",
  code: "EUR",
  rates: [
    { no: "210/A/NBP/2026", effectiveDate: "2026-10-29", mid: 4.2601 },
    { no: "211/A/NBP/2026", effectiveDate: "2026-10-30", mid: 4.25 },
  ],
};

describe("NBP, tabela A", () => {
  it("kurs na niedzielę (i święto) = ostatni opublikowany, z piątku", async () => {
    const fetchFn = vi.fn<FetchFn>(async () => json(eurRates));
    const nbp = createNbpFxProvider({ fetchFn });
    const q = await nbp.getRate("EUR", "2026-11-01");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][0]).toBe(
      "https://api.nbp.pl/api/exchangerates/rates/a/eur/2026-10-18/2026-11-01/?format=json",
    );
    expect(q).toMatchObject({ currency: "EUR", date: "2026-10-30", table: "A", source: "nbp" });
    expect(q!.ratePln.toString()).toBe("4.25");
  });

  it("zachowuje 4 miejsca kursu bez błędów zmiennoprzecinkowych", async () => {
    const nbp = createNbpFxProvider({ fetchFn: async () => json(eurRates) });
    const [first] = await nbp.getHistory("EUR", "2026-10-29", "2026-10-30");
    expect(first.ratePln.toString()).toBe("4.2601");
  });

  it("404 (brak danych) → brak kursu", async () => {
    const nbp = createNbpFxProvider({
      fetchFn: async () => new Response("404 NotFound - Brak danych", { status: 404 }),
    });
    expect(await nbp.getRate("XYZ", "2026-11-02")).toBeNull();
    expect(await nbp.getHistory("XYZ", "2026-10-01", "2026-10-31")).toEqual([]);
  });

  it("błąd serwera, sieci lub zły format → PricingError", async () => {
    const err500 = createNbpFxProvider({ fetchFn: async () => new Response("", { status: 500 }) });
    await expect(err500.getRate("EUR", "2026-11-02")).rejects.toMatchObject({
      name: "PricingError",
      status: 500,
    });
    const offline = createNbpFxProvider({
      fetchFn: async () => {
        throw new TypeError("fetch failed");
      },
    });
    await expect(offline.getRate("EUR", "2026-11-02")).rejects.toBeInstanceOf(PricingError);
    const bad = createNbpFxProvider({ fetchFn: async () => json({ rates: [{ mid: "x" }] }) });
    await expect(bad.getRate("EUR", "2026-11-02")).rejects.toThrow(/format/);
  });

  it("PLN = 1 bez zapytania", async () => {
    const fetchFn = vi.fn<FetchFn>();
    const q = await createNbpFxProvider({ fetchFn }).getRate("PLN", "2026-11-02");
    expect(q!.ratePln.toString()).toBe("1");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("historia dłuższa niż 93 dni dzielona na zapytania", async () => {
    const fetchFn = vi.fn<FetchFn>(async () => json({ ...eurRates, rates: [] }));
    await createNbpFxProvider({ fetchFn }).getHistory("USD", "2026-01-01", "2026-06-30");
    const ranges = fetchFn.mock.calls.map(([url]) => url.match(/usd\/([\d-]+)\/([\d-]+)\//)!.slice(1));
    expect(ranges).toEqual([
      ["2026-01-01", "2026-04-03"],
      ["2026-04-04", "2026-06-30"],
    ]);
  });

  it("przenosi kurs na każdy dzień kalendarzowy", async () => {
    const nbp = createNbpFxProvider({ fetchFn: async () => json(eurRates) });
    const quotes = await nbp.getHistory("EUR", "2026-10-15", "2026-11-01");
    const days = carryForwardRates(quotes, "2026-10-29", "2026-11-01");
    expect(days.map((d) => [d.day, d.quote.date])).toEqual([
      ["2026-10-29", "2026-10-29"],
      ["2026-10-30", "2026-10-30"],
      ["2026-10-31", "2026-10-30"],
      ["2026-11-01", "2026-10-30"],
    ]);
  });
});
