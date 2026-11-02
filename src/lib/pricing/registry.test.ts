import { describe, expect, it, vi } from "vitest";
import { createManualPriceProvider } from "./manual";
import { createPricing } from "./registry";
import type { FetchFn, InstrumentRef } from "./types";

vi.mock("server-only", () => ({}));

const vwce: InstrumentRef = { assetId: "vwce", currency: "EUR", symbol: "VWCE", priceSource: "PROVIDER" };
const flat: InstrumentRef = { assetId: "fundusz", currency: "PLN", priceSource: "MANUAL" };

const manualPrices = async (i: InstrumentRef) =>
  i.assetId === "fundusz"
    ? [
        { date: "2026-10-20", close: "152.30" },
        { date: "2026-09-30", close: "150.00" },
      ]
    : [];

const noNetwork: FetchFn = async () => {
  throw new Error("w testach nie ma sieci");
};

describe("dostawca ręczny", () => {
  it("ostatnia cena ≤ D i historia w zakresie", async () => {
    const p = createManualPriceProvider(manualPrices);
    const q = await p.getClose(flat, "2026-10-25");
    expect(q).toMatchObject({ assetId: "fundusz", date: "2026-10-20", currency: "PLN", source: "manual" });
    expect(q!.close.toString()).toBe("152.3");
    expect(await p.getClose(flat, "2026-09-01")).toBeNull();
    expect((await p.getHistory(flat, "2026-09-01", "2026-10-31")).map((x) => x.date)).toEqual([
      "2026-09-30",
      "2026-10-20",
    ]);
  });
});

describe("rejestr dostawców", () => {
  it("bez klucza: tylko NBP i ceny ręczne", () => {
    const p = createPricing({ marketPricing: false, manualPrices, fetchFn: noNetwork });
    expect(p.marketStatus).toBe("disabled");
    expect(p.market).toBeNull();
    expect(p.fx.id).toBe("nbp");
    expect(p.priceProviderFor(vwce).id).toBe("manual");
  });

  it("dostawca rynkowy bez implementacji → ceny ręczne i status", () => {
    const p = createPricing({
      marketPricing: true,
      providerName: "EODHD",
      apiKey: "test",
      manualPrices,
      fetchFn: noNetwork,
    });
    expect(p.marketStatus).toBe("not-implemented");
    expect(p.priceProviderFor(vwce).id).toBe("manual");
  });

  it("nieznana nazwa dostawcy", () => {
    const p = createPricing({ marketPricing: true, providerName: "yahoo", apiKey: "k", manualPrices });
    expect(p.marketStatus).toBe("unknown-provider");
  });

  it("kursy ręczne jako zapas dla walut spoza tabeli A", async () => {
    const p = createPricing({
      marketPricing: false,
      manualPrices,
      manualFx: async (c) => (c === "ISK" ? [{ date: "2026-10-01", rate: "0.0291" }] : []),
      fetchFn: async () => new Response("", { status: 404 }),
    });
    const q = await p.fx.getRate("ISK", "2026-11-02");
    expect(q).toMatchObject({ table: "MANUAL", date: "2026-10-01" });
    expect(await p.fx.getRate("XYZ", "2026-11-02")).toBeNull();
  });
});

describe("rejestr ze zmiennych serwera", () => {
  it("czyta PRICING_PROVIDER i PRICING_API_KEY przez env.ts", async () => {
    vi.stubEnv("PRICING_PROVIDER", "twelvedata");
    vi.stubEnv("PRICING_API_KEY", "klucz-testowy");
    const { getPricing } = await import("./server");
    const p = getPricing({ manualPrices, fetchFn: noNetwork });
    expect(p.marketStatus).toBe("not-implemented");
    vi.unstubAllEnvs();
  });
});
