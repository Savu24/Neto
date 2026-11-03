import { D } from "@/lib/money";
import { isDateKey, type DateKey } from "@/lib/portfolio/valuation/dates";

/**
 * Liczby i daty z plików CSV i formularzy (HU-2.4): „1 234,56” i „1,234.56”, minus typograficzny,
 * nawias jako liczba ujemna, dopisek waluty. Wynik to napis dziesiętny dla `D()`, nigdy number.
 */

/** „comma”: 1 234,56 (przecinek dziesiętny); „dot”: 1,234.56 (kropka dziesiętna). */
export type NumberFormat = "comma" | "dot";

const SPACES = /[\s  ']/g;
const CURRENCY = /(zł|pln|eur|usd|gbp|chf|[€$£])/gi;

function clean(raw: string): { body: string; negative: boolean } | null {
  let s = raw.trim().replace(CURRENCY, "").replace(SPACES, "");
  if (s === "") return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[−–]/g, "-");
  if (s.endsWith("-")) {
    negative = !negative;
    s = s.slice(0, -1);
  }
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  }
  return { body: s, negative };
}

/** Liczba w podanym formacie; `null`, gdy to nie liczba. */
export function parseNumber(raw: string, format: NumberFormat): string | null {
  const c = clean(raw);
  if (!c) return null;
  const [group, decimal] = format === "comma" ? [".", ","] : [",", "."];
  const body = c.body.split(group).join("").replace(decimal, ".");
  if (!/^(\d+\.?\d*|\.\d+)$/.test(body)) return null;
  const value = D(body);
  return (c.negative && !value.isZero() ? value.neg() : value).toFixed();
}

/**
 * Format liczby wpisanej ręcznie w formularzu: ostatni separator jest dziesiętny, chyba że po jedynym
 * przecinku stoją dokładnie trzy cyfry w liczbie z kropką (1,234.5). Sam przecinek to przecinek dziesiętny.
 */
export function parseUserNumber(raw: string): string | null {
  const s = raw.trim();
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  return parseNumber(s, lastDot > lastComma ? "dot" : "comma");
}

/**
 * Format liczb w kolumnie na podstawie próbek: rozstrzygają wartości z oboma separatorami
 * albo z separatorem, po którym nie stoją dokładnie trzy cyfry. Remis → przecinek (pliki polskich banków).
 */
export function detectNumberFormat(samples: readonly string[]): NumberFormat {
  let comma = 0;
  let dot = 0;
  for (const raw of samples) {
    const c = clean(raw);
    if (!c) continue;
    const s = c.body;
    const lc = s.lastIndexOf(",");
    const ld = s.lastIndexOf(".");
    if (lc >= 0 && ld >= 0) {
      if (lc > ld) comma++;
      else dot++;
    } else if (lc >= 0) {
      // Kilka przecinków to separatory tysięcy; jeden przed trzema cyframi nic nie rozstrzyga.
      if (s.indexOf(",") !== lc) dot++;
      else if (!/,\d{3}$/.test(s)) comma++;
    } else if (ld >= 0) {
      if (s.indexOf(".") !== ld) comma++;
      else if (!/\.\d{3}$/.test(s)) dot++;
    }
  }
  return dot > comma ? "dot" : "comma";
}

export type DateFormat = "YMD" | "DMY" | "MDY";

const DATE_RE = /^(\d{1,4})[-./](\d{1,2})[-./](\d{1,4})(?:[ T].*)?$/;

/** Data z pliku jako `YYYY-MM-DD`; `null`, gdy niepoprawna. Godzina jest pomijana. */
export function parseDate(raw: string, format: DateFormat): DateKey | null {
  const m = DATE_RE.exec(raw.trim());
  if (!m) return null;
  const [a, b, c] = [m[1], m[2], m[3]];
  let y: string, mo: string, d: string;
  if (a.length === 4) {
    if (format !== "YMD") return null;
    [y, mo, d] = [a, b, c];
  } else if (c.length === 4) {
    if (format === "YMD") return null;
    [y, mo, d] = format === "DMY" ? [c, b, a] : [c, a, b];
  } else {
    return null;
  }
  const key = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  return isDateKey(key) ? key : null;
}

/** Format dat w kolumnie: rok z przodu → YMD; dzień > 12 na drugiej pozycji → MDY; inaczej DMY. */
export function detectDateFormat(samples: readonly string[]): DateFormat {
  let mdy = false;
  for (const raw of samples) {
    const m = DATE_RE.exec(raw.trim());
    if (!m) continue;
    if (m[1].length === 4) return "YMD";
    if (Number(m[2]) > 12) mdy = true;
    if (Number(m[1]) > 12) return "DMY";
  }
  return mdy ? "MDY" : "DMY";
}
