import { z } from "zod";
import { D } from "@/lib/money";
import { addDays, assertDateKey, minDate, type DateKey } from "@/lib/portfolio/valuation/dates";
import { BASE_CURRENCY } from "@/lib/portfolio/valuation/fx";
import { lastOnOrBefore } from "@/lib/portfolio/valuation/series";
import { PricingError, type FetchFn, type FxProvider, type FxQuote } from "./types";

/**
 * Kursy średnie NBP, tabela A (SPEC 7.2). Publiczne API bez klucza:
 *   GET https://api.nbp.pl/api/exchangerates/rates/a/{kod}/{od}/{do}/?format=json
 *   → { table, currency, code, rates: [{ no, effectiveDate, mid }] }
 * Brak danych w przedziale (weekend, święto, waluta spoza tabeli) → HTTP 404. Jedno zapytanie obejmuje
 * najwyżej 93 dni, dłuższe przedziały dzielimy. Kurs na dzień D = ostatni opublikowany z datą ≤ D,
 * więc dla D szukamy w oknie `LOOKBACK_DAYS` wstecz (najdłuższa przerwa w publikacji to kilka dni).
 * Atrybucja „Źródło: NBP” — do potwierdzenia w Etapie 12 (SPEC 12 p. 7, 14).
 */
export const NBP_API = "https://api.nbp.pl/api";
export const NBP_MAX_RANGE_DAYS = 93;
const LOOKBACK_DAYS = 14;
const TIMEOUT_MS = 10_000;

const nbpRatesSchema = z.object({
  table: z.string(),
  code: z.string(),
  rates: z.array(z.object({ no: z.string(), effectiveDate: z.string(), mid: z.number().positive() })),
});

export interface NbpOptions {
  readonly fetchFn?: FetchFn;
  readonly baseUrl?: string;
}

export function createNbpFxProvider(opts: NbpOptions = {}): FxProvider {
  const fetchFn: FetchFn = opts.fetchFn ?? ((input, init) => fetch(input, init));
  const baseUrl = opts.baseUrl ?? NBP_API;
  const id = "nbp";

  async function fetchRange(currency: string, from: DateKey, to: DateKey): Promise<FxQuote[]> {
    const url = `${baseUrl}/exchangerates/rates/a/${currency.toLowerCase()}/${from}/${to}/?format=json`;
    let res: Response;
    try {
      res = await fetchFn(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      throw new PricingError(`NBP: błąd połączenia (${(e as Error).name})`, id);
    }
    if (res.status === 404) return [];
    if (!res.ok) throw new PricingError(`NBP: odpowiedź ${res.status}`, id, res.status);
    const parsed = nbpRatesSchema.safeParse(await res.json().catch(() => null));
    if (!parsed.success) throw new PricingError("NBP: nieoczekiwany format odpowiedzi", id, res.status);
    return parsed.data.rates.map((r) => ({
      currency: parsed.data.code.toUpperCase(),
      date: assertDateKey(r.effectiveDate),
      // JSON podaje kurs jako liczbę z 4 miejscami; String() odtwarza dokładnie ten zapis.
      ratePln: D(String(r.mid)),
      table: "A" as const,
      source: id,
    }));
  }

  async function getHistory(currency: string, from: DateKey, to: DateKey): Promise<FxQuote[]> {
    assertDateKey(from);
    assertDateKey(to);
    if (currency === BASE_CURRENCY || from > to) return [];
    const out: FxQuote[] = [];
    for (let start = from; start <= to; start = addDays(start, NBP_MAX_RANGE_DAYS)) {
      const end = minDate(addDays(start, NBP_MAX_RANGE_DAYS - 1), to);
      out.push(...(await fetchRange(currency, start, end)));
    }
    return out;
  }

  async function getRate(currency: string, date: DateKey): Promise<FxQuote | null> {
    if (currency === BASE_CURRENCY) {
      return { currency, date: assertDateKey(date), ratePln: D(1), table: "A", source: id };
    }
    const quotes = await getHistory(currency, addDays(date, -LOOKBACK_DAYS), date);
    return lastOnOrBefore(quotes, date) ?? null;
  }

  return { id, getRate, getHistory };
}

/**
 * Kurs dla każdego dnia kalendarzowego w [from, to] z przeniesieniem kursu na weekendy i święta.
 * `quotes` powinny zaczynać się przed `from` (np. pobrane od from − 14 dni), inaczej pierwsze dni bez kursu
 * są pominięte. Zwrócony `date` notowania to data publikacji, `day` — dzień, na który kurs obowiązuje.
 */
export function carryForwardRates(
  quotes: readonly FxQuote[],
  from: DateKey,
  to: DateKey,
): { day: DateKey; quote: FxQuote }[] {
  const out: { day: DateKey; quote: FxQuote }[] = [];
  for (let day = assertDateKey(from); day <= to; day = addDays(day, 1)) {
    const quote = lastOnOrBefore(quotes, day);
    if (quote) out.push({ day, quote });
  }
  return out;
}
