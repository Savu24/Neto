/**
 * Czytanie plików CSV z banków i biur maklerskich (HU-2.4), bez bibliotek:
 * kodowanie (UTF-8 z BOM lub bez, Windows-1250), separator (; , tabulator |), cudzysłowy wg RFC 4180,
 * wiersz nagłówka (pierwszy wiersz o typowej liczbie kolumn; banki dopisują nad nim metryczkę).
 */

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 20_000;

export type Encoding = "utf-8" | "windows-1250";
export type Delimiter = ";" | "," | "\t" | "|";

const DELIMITERS: readonly Delimiter[] = [";", ",", "\t", "|"];

/** UTF-8, gdy bajty są poprawnym UTF-8; inaczej Windows-1250 (eksporty starszych systemów bankowych). */
export function decode(bytes: Uint8Array, encoding?: Encoding): { text: string; encoding: Encoding } {
  if (encoding !== "windows-1250") {
    try {
      const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
      return { text, encoding: "utf-8" };
    } catch {
      if (encoding === "utf-8") throw new Error("Plik nie jest w kodowaniu UTF-8");
    }
  }
  return { text: new TextDecoder("windows-1250").decode(bytes), encoding: "windows-1250" };
}

export interface CsvRow {
  /** Numer linii pliku (od 1), w której zaczyna się wiersz. */
  readonly line: number;
  readonly cells: string[];
}

/** Parser RFC 4180: pola w cudzysłowach mogą zawierać separator, nową linię i podwójny cudzysłów. */
export function parseCsvLines(text: string, delimiter: Delimiter): CsvRow[] {
  const rows: CsvRow[] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let line = 1;
  let rowLine = 1;
  let i = 0;
  const pushRow = () => {
    row.push(field);
    if (row.length > 1 || row[0].trim() !== "") rows.push({ line: rowLine, cells: row.map((f) => f.trim()) });
    row = [];
    field = "";
  };
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
      } else {
        if (ch === "\n") line++;
        field += ch;
      }
      i++;
      continue;
    }
    if (ch === '"' && field.trim() === "") {
      quoted = true;
      field = "";
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      pushRow();
      if (ch === "\r" && text[i + 1] === "\n") i++;
      line++;
      rowLine = line;
    } else {
      field += ch;
    }
    i++;
  }
  if (field !== "" || row.length > 0) pushRow();
  return rows;
}

export function parseCsv(text: string, delimiter: Delimiter): string[][] {
  return parseCsvLines(text, delimiter).map((r) => r.cells);
}

/** Separator, który daje najwięcej wierszy o tej samej liczbie kolumn (> 1). */
export function detectDelimiter(text: string): Delimiter {
  const sample = text.slice(0, 64 * 1024);
  let best: Delimiter = ";";
  let bestScore = -1;
  for (const d of DELIMITERS) {
    const rows = parseCsv(sample, d).slice(0, 50);
    const counts = new Map<number, number>();
    for (const r of rows) if (r.length > 1) counts.set(r.length, (counts.get(r.length) ?? 0) + 1);
    const score = Math.max(0, ...counts.values());
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

/** Indeks wiersza nagłówka: pierwszy wiersz z najczęstszą liczbą kolumn. */
export function detectHeaderRow(rows: readonly string[][]): number {
  const counts = new Map<number, number>();
  for (const r of rows.slice(0, 200)) counts.set(r.length, (counts.get(r.length) ?? 0) + 1);
  let width = 0;
  let max = 0;
  for (const [w, c] of counts) {
    if (w > 1 && (c > max || (c === max && w > width))) {
      width = w;
      max = c;
    }
  }
  const index = rows.findIndex((r) => r.length === width);
  return index < 0 ? 0 : index;
}

export interface ParsedFile {
  readonly encoding: Encoding;
  readonly delimiter: Delimiter;
  readonly headers: readonly string[];
  readonly rows: readonly string[][];
  /** Numery linii pliku (od 1) wierszy danych, do komunikatów o błędach. */
  readonly lines: readonly number[];
}

export class CsvError extends Error {
  constructor(readonly code: "tooLarge" | "tooManyRows" | "empty" | "noHeader") {
    super(code);
    this.name = "CsvError";
  }
}

export function readCsv(
  bytes: Uint8Array,
  opts: { encoding?: Encoding; delimiter?: Delimiter } = {},
): ParsedFile {
  if (bytes.byteLength > MAX_FILE_BYTES) throw new CsvError("tooLarge");
  const { text, encoding } = decode(bytes, opts.encoding);
  const clean = text.replace(/^﻿/, "");
  if (clean.trim() === "") throw new CsvError("empty");
  const delimiter = opts.delimiter ?? detectDelimiter(clean);
  const parsed = parseCsvLines(clean, delimiter);
  const all = parsed.map((r) => r.cells);
  const headerIndex = detectHeaderRow(all);
  const header = all[headerIndex];
  if (!header || header.length < 2) throw new CsvError("noHeader");
  const data = parsed.slice(headerIndex + 1).filter((r) => r.cells.some((c) => c !== ""));
  if (data.length === 0) throw new CsvError("empty");
  if (data.length > MAX_ROWS) throw new CsvError("tooManyRows");
  // Nazwy kolumn muszą być niepuste i unikalne, bo po nich zapamiętujemy mapowanie.
  const seen = new Map<string, number>();
  const headers = header.map((h, i) => {
    const base = h || `#${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n > 1 ? `${base} (${n})` : base;
  });
  return {
    encoding,
    delimiter,
    headers,
    rows: data.map((r) => r.cells),
    lines: data.map((r) => r.line),
  };
}
