import type { FetchFn, PriceProvider } from "./types";

/**
 * Dostawcy cen rynkowych (SPEC 14) — tylko szkielet. Dostawca nie jest wybrany, a licencje
 * nie są sprawdzone, więc nie zgadujemy ich API. Wartość `PRICING_PROVIDER` wybiera wpis poniżej;
 * dopóki `create` nie istnieje, rejestr używa wyłącznie cen ręcznych.
 *
 * TODO przed implementacją któregokolwiek (decyzja właściciela, SPEC 1 i 14):
 * - licencja: użycie komercyjne i wyświetlanie danych użytkownikom końcowym aplikacji (web i iOS);
 * - wymagana atrybucja i miejsce jej pokazania (Etap 12);
 * - pokrycie: GPW (XWAR), Xetra, giełdy USA, ETF UCITS, fundusze, krypto; identyfikacja po tickerze/ISIN/MIC;
 * - ceny zamknięcia: o której są dostępne po sesji (cron 22:30 Warszawa, SPEC 7.7), strefa czasu dat;
 * - historia wstecz: od kiedy i w jakich porcjach (SPEC 7.7 — historia od daty zakupu);
 * - limity zapytań i ceny planów przy N użytkownikach; zapytania zbiorcze (wiele instrumentów naraz);
 * - format liczb w odpowiedzi (napis czy liczba) — ceny muszą trafić do Decimal bez utraty precyzji;
 * - waluta notowania (np. pensy GBX na LSE) i korekty o splity/dywidendy (bierzemy cenę nieskorygowaną).
 */
export interface MarketProviderEntry {
  readonly id: string;
  readonly name: string;
  /** Do sprawdzenia przed wdrożeniem (SPEC 14). */
  readonly toVerify: readonly string[];
  readonly create?: (config: { apiKey: string; fetchFn?: FetchFn }) => PriceProvider;
}

export const MARKET_PROVIDERS: Readonly<Record<string, MarketProviderEntry>> = {
  eodhd: {
    id: "eodhd",
    name: "EODHD",
    toVerify: [
      "licencja komercyjna (plany opisane jako „Personal use”)",
      "warunki wyświetlania użytkownikom",
    ],
  },
  twelvedata: {
    id: "twelvedata",
    name: "Twelve Data",
    toVerify: ["pokrycie GPW", "licencja na wyświetlanie użytkownikom końcowym"],
  },
  fmp: {
    id: "fmp",
    name: "Financial Modeling Prep",
    toVerify: ["pokrycie GPW", "licencja na wyświetlanie użytkownikom końcowym"],
  },
  coingecko: {
    id: "coingecko",
    name: "CoinGecko",
    toVerify: ["plan komercyjny", "wymóg atrybucji"],
  },
};
