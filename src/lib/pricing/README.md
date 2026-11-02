# pricing

Ceny i kursy walut (Etap 6) za interfejsem dostawcy (`PriceProvider`, `FxProvider` w `types.ts`). Domyślnie kursy NBP (tabela A, `nbp.ts`) i ceny ręczne (`manual.ts`); dostawca rynkowy włącza się kluczem `PRICING_PROVIDER` + `PRICING_API_KEY`, ale żaden nie ma jeszcze implementacji — szkielet i lista rzeczy do sprawdzenia w `market.ts` (SPEC 14).

- `createPricing(config)` (`registry.ts`) wybiera dostawców bez czytania środowiska; `getPricing()` (`server.ts`, tylko serwer) bierze konfigurację z `src/env.ts`.
- Instrument z `priceSource: "MANUAL"` zawsze ma cenę ręczną.
- Testy nie łączą się z siecią: `fetchFn` jest wstrzykiwany.
