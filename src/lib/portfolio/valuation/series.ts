import { assertDateKey, type DateKey } from "./dates";

/**
 * Szeregi z datą (ceny, kursy, wyceny ręczne, salda). Wejście może być w dowolnej kolejności;
 * posortowana kopia jest zapamiętywana per tablica, więc liczenie historii dzień po dniu nie sortuje
 * w kółko. Dlatego tablic przekazanych do wyceny nie modyfikujemy po pierwszym użyciu.
 */
export interface Dated {
  readonly date: DateKey;
}

const sortedCache = new WeakMap<readonly Dated[], readonly Dated[]>();

/** Kopia posortowana rosnąco po dacie; przy tej samej dacie zachowuje kolejność wejścia (później wpisane wygrywa). */
export function sortedByDate<T extends Dated>(points: readonly T[]): readonly T[] {
  const cached = sortedCache.get(points);
  if (cached) return cached as readonly T[];
  for (const p of points) assertDateKey(p.date);
  const sorted = points
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (a.p.date < b.p.date ? -1 : a.p.date > b.p.date ? 1 : a.i - b.i))
    .map(({ p }) => p);
  sortedCache.set(points, sorted);
  return sorted;
}

/** Indeks ostatniego punktu z datą ≤ `date` w posortowanej tablicy albo -1. */
export function lastIndexOnOrBefore(sorted: readonly Dated[], date: DateKey): number {
  let lo = 0;
  let hi = sorted.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid].date <= date) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/** Ostatni punkt z datą ≤ `date` (SPEC 7.2/7.3: funkcja schodkowa, bez interpolacji). */
export function lastOnOrBefore<T extends Dated>(points: readonly T[], date: DateKey): T | undefined {
  const sorted = sortedByDate(points);
  const i = lastIndexOnOrBefore(sorted, date);
  return i < 0 ? undefined : sorted[i];
}

/** Pamięć wyniku funkcji per tablica wejściowa (np. skumulowane ilości z transakcji). */
export function memoByArray<A extends object, R>(fn: (input: A) => R): (input: A) => R {
  const cache = new WeakMap<A, R>();
  return (input) => {
    if (cache.has(input)) return cache.get(input) as R;
    const result = fn(input);
    cache.set(input, result);
    return result;
  };
}
