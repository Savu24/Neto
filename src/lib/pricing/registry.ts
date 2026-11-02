import { createManualFxProvider, createManualPriceProvider, chainFxProviders } from "./manual";
import type { ManualFxSource, ManualPriceSource } from "./manual";
import { MARKET_PROVIDERS } from "./market";
import { createNbpFxProvider } from "./nbp";
import type { FetchFn, FxProvider, InstrumentRef, PriceProvider } from "./types";

/**
 * Wybór dostawców (SPEC 14, 15). Bez `PRICING_PROVIDER` + `PRICING_API_KEY` (flaga `marketPricing`)
 * działają tylko kursy NBP i ceny ręczne. Z flagą — dostawca rynkowy o nazwie z `PRICING_PROVIDER`,
 * o ile ma implementację w `market.ts`; inaczej zostają ceny ręczne i `marketStatus` mówi dlaczego.
 * Instrument z `priceSource: "MANUAL"` zawsze bierze cenę ręczną.
 *
 * Ta funkcja nie czyta środowiska; wersja ze zmiennymi serwera jest w `server.ts`.
 */
export type MarketStatus = "disabled" | "unknown-provider" | "not-implemented" | "active";

export interface PricingConfig {
  readonly marketPricing: boolean;
  readonly providerName?: string;
  readonly apiKey?: string;
  readonly manualPrices: ManualPriceSource;
  /** Kursy ręczne dla walut spoza tabeli A (opcjonalnie). */
  readonly manualFx?: ManualFxSource;
  readonly fetchFn?: FetchFn;
}

export interface Pricing {
  readonly fx: FxProvider;
  readonly manual: PriceProvider;
  readonly market: PriceProvider | null;
  readonly marketStatus: MarketStatus;
  priceProviderFor(instrument: InstrumentRef): PriceProvider;
}

export function createPricing(config: PricingConfig): Pricing {
  const nbp = createNbpFxProvider({ fetchFn: config.fetchFn });
  const fx = config.manualFx ? chainFxProviders([nbp, createManualFxProvider(config.manualFx)]) : nbp;
  const manual = createManualPriceProvider(config.manualPrices);

  let market: PriceProvider | null = null;
  let marketStatus: MarketStatus = "disabled";
  if (config.marketPricing && config.apiKey) {
    const entry = MARKET_PROVIDERS[(config.providerName ?? "").trim().toLowerCase()];
    if (!entry) marketStatus = "unknown-provider";
    else if (!entry.create) marketStatus = "not-implemented";
    else {
      market = entry.create({ apiKey: config.apiKey, fetchFn: config.fetchFn });
      marketStatus = "active";
    }
  }

  return {
    fx,
    manual,
    market,
    marketStatus,
    priceProviderFor: (instrument) => (instrument.priceSource === "PROVIDER" && market ? market : manual),
  };
}
