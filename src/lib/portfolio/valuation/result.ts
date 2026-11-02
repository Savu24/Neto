import { D, sum, ZERO, type Dec, type DecInput } from "@/lib/money";
import { lotCost, lotCostPln, type Lot } from "./fifo";

/**
 * Wynik niezrealizowany pozycji (SPEC 7.6), dla pozostałych partii FIFO:
 *   V_w = ilość × cena, K_w = koszt partii w walucie instrumentu, K_pln = koszt po kursach z dat zakupu.
 *   wynik całkowity = V_w × kurs − K_pln
 *   w tym zmiana ceny (wynik instrumentu) = (V_w − K_w) × kurs
 *   w tym efekt walutowy = K_w × kurs − K_pln
 * Składniki sumują się dokładnie do wyniku całkowitego (arytmetyka dziesiętna, bez zaokrągleń).
 * Zaokrąglone do groszy osobno mogą różnić się od zaokrąglonej sumy o 0,01 zł.
 */
export interface PositionResultInput {
  readonly lots: readonly Lot[];
  /** Cena zamknięcia w walucie instrumentu. */
  readonly price: DecInput;
  /** Kurs dnia, PLN za 1 jednostkę waluty instrumentu (1 dla PLN). */
  readonly fxRate: DecInput;
}

export interface PositionResult {
  readonly quantity: Dec;
  /** V_w */
  readonly value: Dec;
  readonly valuePln: Dec;
  /** K_w */
  readonly cost: Dec;
  /** K_pln */
  readonly costPln: Dec;
  /** Średni koszt jednostkowy w walucie instrumentu; `null` przy zerowej ilości. */
  readonly averageCost: Dec | null;
  readonly totalPln: Dec;
  readonly priceEffectPln: Dec;
  readonly fxEffectPln: Dec;
  /** Wynik całkowity ÷ K_pln; `null`, gdy koszt ≤ 0. */
  readonly totalPercent: Dec | null;
}

export function positionResult({ lots, price, fxRate }: PositionResultInput): PositionResult {
  const rate = D(fxRate);
  const quantity = sum(lots.map((l) => l.remaining));
  const value = quantity.times(price);
  const cost = sum(lots.map(lotCost));
  const costPln = sum(lots.map(lotCostPln));
  const valuePln = value.times(rate);
  const totalPln = valuePln.minus(costPln);
  return {
    quantity,
    value,
    valuePln,
    cost,
    costPln,
    averageCost: quantity.isZero() ? null : cost.div(quantity),
    totalPln,
    priceEffectPln: value.minus(cost).times(rate),
    fxEffectPln: cost.times(rate).minus(costPln),
    totalPercent: costPln.gt(ZERO) ? totalPln.div(costPln) : null,
  };
}
