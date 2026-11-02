import { warsawDateKey } from "@/lib/format";

/**
 * Dzień wyceny jako napis `YYYY-MM-DD` w strefie Europe/Warsaw (SPEC 7.1).
 * Arytmetyka dni liczona w UTC na północy: data nie ma godziny, więc zmiana czasu letniego niczego nie przesuwa.
 * Napisy w tym formacie porównują się leksykograficznie tak samo jak daty.
 */
export type DateKey = string;

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isDateKey(value: string): boolean {
  const m = DATE_KEY.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

export function assertDateKey(value: string): DateKey {
  if (!isDateKey(value)) throw new RangeError(`Nieprawidłowa data dnia wyceny: ${value}`);
  return value;
}

function parts(key: DateKey): [number, number, number] {
  assertDateKey(key);
  return [Number(key.slice(0, 4)), Number(key.slice(5, 7)), Number(key.slice(8, 10))];
}

function toUtcMs(key: DateKey): number {
  const [y, m, d] = parts(key);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): DateKey {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Dzisiejszy dzień wyceny w Warszawie. */
export function todayKey(now: Date = new Date()): DateKey {
  return warsawDateKey(now);
}

/** Liczba dni od `from` do `to` (ujemna, gdy `to` jest wcześniej). */
export function daysBetween(from: DateKey, to: DateKey): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

export function addDays(key: DateKey, days: number): DateKey {
  return fromUtcMs(toUtcMs(key) + days * DAY_MS);
}

/** Dodaje miesiące; dzień ponad koniec miesiąca przycina do ostatniego dnia (31.01 + 1 mies. = 28/29.02). */
export function addMonths(key: DateKey, months: number): DateKey {
  const [y, m, d] = parts(key);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const nd = Math.min(d, daysInMonth(ny, nm));
  return `${String(ny).padStart(4, "0")}-${String(nm).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
}

export function endOfMonth(key: DateKey): DateKey {
  const [y, m] = parts(key);
  return `${key.slice(0, 8)}${String(daysInMonth(y, m)).padStart(2, "0")}`;
}

/** 0 = niedziela … 6 = sobota. */
export function dayOfWeek(key: DateKey): number {
  return new Date(toUtcMs(key)).getUTCDay();
}

export function isWeekend(key: DateKey): boolean {
  const dow = dayOfWeek(key);
  return dow === 0 || dow === 6;
}

export function minDate(a: DateKey, b: DateKey): DateKey {
  return a <= b ? a : b;
}

export function maxDate(a: DateKey, b: DateKey): DateKey {
  return a >= b ? a : b;
}

/** Kolejne dni od `from` do `to` włącznie. */
export function eachDay(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let d = assertDateKey(from); d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
