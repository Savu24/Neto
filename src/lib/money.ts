import Decimal from "decimal.js";

/**
 * Arytmetyka pieniędzy i ilości (SPEC 7.1). W logice finansowej tylko Decimal, nigdy number.
 * Własny konstruktor z precyzją 40 cyfr, żeby nie zmieniać globalnej konfiguracji decimal.js.
 */
export const Dec = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Dec = InstanceType<typeof Dec>;

export type DecInput = Dec | string | number;

export function D(value: DecInput): Dec {
  return value instanceof Dec ? value : new Dec(value);
}

export const ZERO = D(0);

export function sum(values: Iterable<DecInput>): Dec {
  let acc = ZERO;
  for (const v of values) acc = acc.plus(D(v));
  return acc;
}

/** Kwota do zapisu/wyświetlenia: 2 miejsca po przecinku, zaokrąglenie połówkowe w górę. */
export function toMoneyString(value: DecInput, decimals = 2): string {
  return D(value).toFixed(decimals, Dec.ROUND_HALF_UP);
}

/** Kurs walut i ilości w bazie: Decimal(28,10). */
export function toQuantityString(value: DecInput): string {
  return D(value).toDecimalPlaces(10, Dec.ROUND_HALF_UP).toFixed();
}
