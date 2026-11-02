import "server-only";
import { env, features } from "@/env";
import { createPricing, type Pricing, type PricingConfig } from "./registry";

/** Dostawcy według zmiennych środowiskowych serwera (`features().marketPricing`). */
export function getPricing(sources: Pick<PricingConfig, "manualPrices" | "manualFx" | "fetchFn">): Pricing {
  const e = env();
  return createPricing({
    ...sources,
    marketPricing: features().marketPricing,
    providerName: e.PRICING_PROVIDER,
    apiKey: e.PRICING_API_KEY,
  });
}
