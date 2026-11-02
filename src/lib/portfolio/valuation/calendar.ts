import { addDays, dayOfWeek, type DateKey } from "./dates";

/**
 * Kalendarz dni roboczych do progów nieaktualności (SPEC 7.8).
 *
 * "PL": poniedziałek–piątek bez ustawowych świąt w Polsce (ustawa o dniach wolnych od pracy):
 * 1.01, 6.01 (od 2011), Wielkanoc i poniedziałek wielkanocny, 1.05, 3.05, Zielone Świątki (niedziela),
 * Boże Ciało, 15.08, 1.11, 11.11, 24.12 (od 2025), 25.12, 26.12.
 * To kalendarz publikacji kursów NBP. Sesje giełd zagranicznych mają inne dni wolne; dla nich
 * dzień wolny giełdy liczy się jako roboczy, co przy progu 3 dni najwyżej o dzień przyspiesza ostrzeżenie.
 * GPW nie handluje też 31.12 — tego kalendarz nie uwzględnia.
 *
 * "WEEKDAYS": same dni powszednie, bez świąt.
 */
export type BusinessCalendar = "PL" | "WEEKDAYS";

/** Niedziela Wielkanocna (algorytm Meeusa/Jonesa/Butchera, kalendarz gregoriański). */
export function easterSunday(year: number): DateKey {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const holidayCache = new Map<number, ReadonlySet<DateKey>>();

export function polishHolidays(year: number): ReadonlySet<DateKey> {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const y = String(year);
  const easter = easterSunday(year);
  const days = [
    `${y}-01-01`,
    ...(year >= 2011 ? [`${y}-01-06`] : []),
    easter,
    addDays(easter, 1),
    `${y}-05-01`,
    `${y}-05-03`,
    addDays(easter, 49),
    addDays(easter, 60),
    `${y}-08-15`,
    `${y}-11-01`,
    `${y}-11-11`,
    ...(year >= 2025 ? [`${y}-12-24`] : []),
    `${y}-12-25`,
    `${y}-12-26`,
  ];
  const set = new Set(days);
  holidayCache.set(year, set);
  return set;
}

export function isBusinessDay(key: DateKey, calendar: BusinessCalendar = "PL"): boolean {
  const dow = dayOfWeek(key);
  if (dow === 0 || dow === 6) return false;
  return calendar === "WEEKDAYS" || !polishHolidays(Number(key.slice(0, 4))).has(key);
}

/** Liczba dni roboczych d, dla których `from` < d ≤ `to`. Dla `to` ≤ `from` zwraca 0. */
export function businessDaysBetween(from: DateKey, to: DateKey, calendar: BusinessCalendar = "PL"): number {
  let count = 0;
  for (let d = addDays(from, 1); d <= to; d = addDays(d, 1)) if (isBusinessDay(d, calendar)) count++;
  return count;
}

export function previousBusinessDay(key: DateKey, calendar: BusinessCalendar = "PL"): DateKey {
  let d = addDays(key, -1);
  while (!isBusinessDay(d, calendar)) d = addDays(d, -1);
  return d;
}
