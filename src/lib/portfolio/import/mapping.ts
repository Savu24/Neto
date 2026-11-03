import type { AccountType, TransactionType } from "@/generated/prisma/enums";
import { D } from "@/lib/money";
import { allowedTransactions, amountSign, isTrade } from "@/lib/portfolio/ledger/types";
import type { DateKey } from "@/lib/portfolio/valuation/dates";
import {
  detectDateFormat,
  detectNumberFormat,
  parseDate,
  parseNumber,
  type DateFormat,
  type NumberFormat,
} from "./numbers";

/**
 * Mapowanie kolumn pliku na pola transakcji (krok 2 importu) i zamiana wierszy na szkice transakcji
 * (krok 3, podgląd z błędami w wierszach). Czyste funkcje: instrumenty, duplikaty i sprzedaż ponad stan
 * sprawdza serwer (`service.ts`).
 */

export const FIELDS = [
  "date",
  "amount",
  "type",
  "description",
  "symbol",
  "quantity",
  "price",
  "fee",
  "currency",
] as const;
export type Field = (typeof FIELDS)[number];

export interface Mapping {
  /** Pole → nazwa kolumny z nagłówka. */
  readonly columns: Partial<Record<Field, string>>;
  readonly dateFormat: DateFormat;
  readonly numberFormat: NumberFormat;
}

/** Klucz zapamiętanego mapowania (`ImportMapping.source`): nagłówek pliku, bez wielkości liter. */
export function headerSignature(headers: readonly string[]): string {
  return headers
    .map((h) => h.trim().toLowerCase())
    .join("|")
    .slice(0, 500);
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9/]+/g, " ")
    .trim();
}

const HEADER_HINTS: Record<Field, readonly string[]> = {
  date: [
    "data operacji",
    "data transakcji",
    "data ksiegowania",
    "data",
    "date",
    "trade date",
    "czas",
    "time",
  ],
  amount: ["kwota", "amount", "wartosc", "value", "total", "kwota operacji", "net amount"],
  type: ["typ", "type", "rodzaj", "kierunek", "k/s", "operacja", "side", "typ operacji", "typ transakcji"],
  description: ["opis", "description", "tytul", "title", "szczegoly", "details", "komentarz", "comment"],
  symbol: ["ticker", "symbol", "isin", "instrument", "walor", "papier"],
  quantity: ["ilosc", "liczba", "quantity", "qty", "shares", "wolumen", "volume", "liczba sztuk"],
  price: ["cena", "price", "kurs instrumentu", "cena jednostkowa", "unit price"],
  fee: ["prowizja", "oplata", "fee", "commission", "fees"],
  currency: ["waluta", "currency", "ccy"],
};

/** Propozycja mapowania z nazw kolumn: najpierw dokładne trafienia, potem zawieranie słowa. */
export function suggestColumns(headers: readonly string[]): Partial<Record<Field, string>> {
  const result: Partial<Record<Field, string>> = {};
  const used = new Set<string>();
  const norm = headers.map((h) => ({ header: h, n: normalize(h) }));
  for (const pass of ["exact", "contains"] as const) {
    for (const field of FIELDS) {
      if (result[field]) continue;
      for (const hint of HEADER_HINTS[field]) {
        const hit = norm.find(
          ({ header, n }) =>
            !used.has(header) &&
            (pass === "exact" ? n === hint : n.split(" ").includes(hint) || n.startsWith(`${hint} `)),
        );
        if (hit) {
          result[field] = hit.header;
          used.add(hit.header);
          break;
        }
      }
    }
  }
  return result;
}

export function suggestMapping(headers: readonly string[], rows: readonly string[][]): Mapping {
  const columns = suggestColumns(headers);
  const sample = (field: Field) => {
    const i = columns[field] ? headers.indexOf(columns[field]) : -1;
    return i < 0 ? [] : rows.slice(0, 200).map((r) => r[i] ?? "");
  };
  return {
    columns,
    dateFormat: detectDateFormat(sample("date")),
    numberFormat: detectNumberFormat([...sample("amount"), ...sample("price"), ...sample("quantity")]),
  };
}

const TYPE_WORDS: readonly [TransactionType, readonly string[]][] = [
  ["BUY", ["kupno", "buy", "k", "b", "zakup", "purchase", "kup"]],
  ["SELL", ["sprzedaz", "sell", "s", "sprzedano", "sale", "sprz"]],
  ["DIVIDEND", ["dywidenda", "dividend", "dyw"]],
  ["INTEREST", ["odsetki", "interest", "kapitalizacja odsetek", "kapitalizacja"]],
  ["FEE", ["oplata", "prowizja", "fee", "commission"]],
  ["TAX", ["podatek", "tax", "podatek belki"]],
  ["DEPOSIT", ["wplata", "deposit", "uznanie", "credit", "przelew przychodzacy"]],
  ["WITHDRAWAL", ["wyplata", "withdrawal", "obciazenie", "debit", "przelew wychodzacy"]],
];

/** Rodzaj transakcji z wartości kolumny „typ”: całe słowo albo jego początek. */
export function parseTypeWord(raw: string): TransactionType | null {
  const n = normalize(raw);
  if (!n) return null;
  for (const [type, words] of TYPE_WORDS) if (words.includes(n)) return type;
  for (const [type, words] of TYPE_WORDS) {
    if (words.some((w) => w.length > 2 && (n.startsWith(`${w} `) || n.split(" ").includes(w)))) return type;
  }
  return null;
}

export type RowErrorCode =
  | "missingDate"
  | "badDate"
  | "futureDate"
  | "badAmount"
  | "zeroAmount"
  | "unknownType"
  | "typeNotAllowed"
  | "missingSymbol"
  | "badQuantity"
  | "badPrice"
  | "badFee"
  | "badCurrency"
  | "unknownInstrument"
  | "insufficientQuantity"
  | "missingFx"
  | "duplicate";

export interface Draft {
  readonly date: DateKey;
  readonly type: TransactionType;
  /** Kwota ze znakiem skutku dla gotówki (jak `Transaction.amount`). */
  readonly amount: string;
  readonly quantity: string | null;
  readonly price: string | null;
  readonly fee: string | null;
  /** Waluta z pliku; `null` → waluta konta albo instrumentu (ustala serwer). */
  readonly currency: string | null;
  readonly symbol: string | null;
  readonly note: string | null;
}

export type RowResult =
  | { readonly line: number; readonly ok: true; readonly draft: Draft }
  | {
      readonly line: number;
      readonly ok: false;
      readonly error: RowErrorCode;
      readonly params?: Record<string, string>;
    };

export interface DraftContext {
  readonly accountType: AccountType;
  readonly today: DateKey;
  /** Numery linii pliku wierszy danych (do komunikatów „wiersz 12”); domyślnie nagłówek w linii 1. */
  readonly lines?: readonly number[];
}

const NOTE_MAX = 200;

export function rowsToDrafts(
  headers: readonly string[],
  rows: readonly string[][],
  mapping: Mapping,
  ctx: DraftContext,
): RowResult[] {
  const col = (field: Field) => {
    const name = mapping.columns[field];
    return name ? headers.indexOf(name) : -1;
  };
  const idx = Object.fromEntries(FIELDS.map((f) => [f, col(f)])) as Record<Field, number>;
  const allowed = allowedTransactions(ctx.accountType);

  const num = (raw: string) => parseNumber(raw, mapping.numberFormat);

  return rows.map((row, i): RowResult => {
    const line = ctx.lines?.[i] ?? i + 2;
    const cell = (f: Field) => (idx[f] >= 0 ? (row[idx[f]] ?? "").trim() : "");
    const fail = (error: RowErrorCode, params?: Record<string, string>): RowResult => ({
      line,
      ok: false,
      error,
      params,
    });

    const rawDate = cell("date");
    if (!rawDate) return fail("missingDate");
    const date = parseDate(rawDate, mapping.dateFormat);
    if (!date) return fail("badDate", { value: rawDate });
    if (date > ctx.today) return fail("futureDate", { value: rawDate });

    const rawAmount = cell("amount");
    const amount = rawAmount ? num(rawAmount) : null;
    if (rawAmount && amount === null) return fail("badAmount", { value: rawAmount });

    const rawType = cell("type");
    let type: TransactionType | null = rawType ? parseTypeWord(rawType) : null;
    if (rawType && !type && idx.type >= 0 && !amount) return fail("unknownType", { value: rawType });
    if (!type) {
      if (amount === null) return fail("badAmount", { value: rawAmount });
      if (D(amount).isZero()) return fail("zeroAmount");
      type = D(amount).isNeg() ? "WITHDRAWAL" : "DEPOSIT";
    }
    if (!allowed.includes(type)) return fail("typeNotAllowed", { type });

    const rawCurrency = cell("currency").toUpperCase();
    if (rawCurrency && !/^[A-Z]{3}$/.test(rawCurrency)) return fail("badCurrency", { value: rawCurrency });
    const currency = rawCurrency || null;
    const note = cell("description").slice(0, NOTE_MAX) || null;
    const rawFee = cell("fee");
    const feeValue = rawFee ? num(rawFee) : null;
    if (rawFee && feeValue === null) return fail("badFee", { value: rawFee });
    const fee = feeValue ? D(feeValue).abs() : null;

    if (isTrade(type)) {
      const symbol = cell("symbol").toUpperCase();
      if (!symbol) return fail("missingSymbol");
      const rawQty = cell("quantity");
      const qty = rawQty ? num(rawQty) : null;
      if (!qty || D(qty).isZero()) return fail("badQuantity", { value: rawQty });
      const quantity = D(qty).abs();
      const rawPrice = cell("price");
      let price = rawPrice ? num(rawPrice) : null;
      if (rawPrice && price === null) return fail("badPrice", { value: rawPrice });
      if (price === null) {
        // Bez kolumny ceny: cena z kwoty (kwota bez prowizji ÷ ilość).
        if (amount === null || D(amount).isZero()) return fail("badPrice", { value: rawPrice });
        const gross = D(amount).abs();
        const net = fee ? (type === "BUY" ? gross.minus(fee) : gross.plus(fee)) : gross;
        price = net.div(quantity).toFixed();
      }
      const p = D(price).abs();
      if (p.isZero()) return fail("badPrice", { value: rawPrice });
      const value = quantity.times(p);
      const settled = type === "BUY" ? value.plus(fee ?? 0) : value.minus(fee ?? 0);
      return {
        line,
        ok: true,
        draft: {
          date,
          type,
          amount: settled.times(amountSign(type)).toFixed(),
          quantity: quantity.toFixed(),
          price: p.toFixed(),
          fee: fee ? fee.toFixed() : null,
          currency,
          symbol,
          note,
        },
      };
    }

    if (amount === null) return fail("badAmount", { value: rawAmount });
    const abs = D(amount).abs();
    if (abs.isZero()) return fail("zeroAmount");
    const sign = amountSign(type);
    return {
      line,
      ok: true,
      draft: {
        date,
        type,
        amount: (sign === 0 ? D(amount) : abs.times(sign)).toFixed(),
        quantity: null,
        price: null,
        fee: null,
        currency,
        symbol: cell("symbol").toUpperCase() || null,
        note,
      },
    };
  });
}

/**
 * Odcisk wiersza do wykrywania duplikatów: treść transakcji + numer wystąpienia identycznej treści w pliku
 * (dwa takie same zakupy kawy jednego dnia to dwie transakcje, a ponowny import tego samego pliku to duplikaty).
 */
export function canonicalRows(drafts: readonly Draft[]): string[] {
  const seen = new Map<string, number>();
  return drafts.map((d) => {
    const base = [d.date, d.type, d.amount, d.quantity, d.price, d.fee, d.currency, d.symbol, d.note]
      .map((v) => v ?? "")
      .join("|");
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return `${base}#${n}`;
  });
}
