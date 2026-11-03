import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { toMoneyString } from "@/lib/money";
import {
  applyFifo,
  InsufficientQuantityError,
  MissingFxRateError,
  type DateKey,
  type TradeInput,
} from "@/lib/portfolio/valuation";
import {
  dateFromKey,
  enqueueRecalc,
  inTransaction,
  keyFromDate,
  LedgerError,
  loadFxTable,
  rebuildHolding,
  toLedgerTx,
  type Ledger,
  type Tx,
} from "@/lib/portfolio/ledger/service";
import { tradesOf } from "@/lib/portfolio/ledger/positions";
import { isTrade } from "@/lib/portfolio/ledger/types";
import { readCsv, type Delimiter, type Encoding, type ParsedFile } from "./csv";
import {
  canonicalRows,
  headerSignature,
  rowsToDrafts,
  suggestMapping,
  type Draft,
  type Mapping,
  type RowErrorCode,
} from "./mapping";

/**
 * Import CSV (HU-2.4) na serwerze: plik → mapowanie → podgląd → import, cofnięcie w 24 h.
 * Serwer jest bezstanowy: klient przy każdym kroku wysyła ten sam plik i mapowanie, a podgląd i import
 * liczą wynik tą samą funkcją (`evaluate`). Duplikaty po `Transaction.fingerprint` na tym samym koncie.
 */

export const REVERT_WINDOW_MS = 24 * 60 * 60 * 1000;
const PREVIEW_ROWS = 200;

export interface ImportFile {
  readonly accountId: string;
  readonly fileName: string;
  readonly bytes: Uint8Array;
  readonly encoding?: Encoding;
  readonly delimiter?: Delimiter;
}

export interface Analysis {
  readonly encoding: Encoding;
  readonly delimiter: Delimiter;
  readonly headers: readonly string[];
  readonly sample: readonly string[][];
  readonly rowCount: number;
  readonly mapping: Mapping;
  /** Mapowanie zapamiętane dla tego nagłówka (HU-2.4: „zapamiętane mapowania per źródło”). */
  readonly remembered: boolean;
}

export type PreviewStatus = "ok" | "duplicate" | "error";

export interface PreviewRow {
  readonly line: number;
  readonly status: PreviewStatus;
  readonly error?: RowErrorCode;
  readonly params?: Record<string, string>;
  readonly date?: DateKey;
  readonly type?: string;
  readonly amount?: string;
  readonly currency?: string;
  readonly quantity?: string | null;
  readonly symbol?: string | null;
  readonly note?: string | null;
}

export interface Preview {
  readonly total: number;
  readonly ok: number;
  readonly duplicates: number;
  readonly errors: number;
  /** Najpierw wiersze z błędami i duplikaty, potem poprawne; najwyżej 200. */
  readonly rows: readonly PreviewRow[];
}

export class ImportError extends Error {
  constructor(
    readonly code: "account" | "archived" | "mapping" | "batch" | "revertExpired" | "revertBreaksSale",
    readonly params: Record<string, string> = {},
  ) {
    super(code);
    this.name = "ImportError";
  }
}

async function importAccount(db: Ledger["db"] | Tx, accountId: string) {
  const account = await db.financialAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new ImportError("account");
  if (account.archivedAt) throw new ImportError("archived");
  return account;
}

export async function analyzeImport(l: Ledger, file: ImportFile): Promise<Analysis> {
  await importAccount(l.db, file.accountId);
  const parsed = readCsv(file.bytes, { encoding: file.encoding, delimiter: file.delimiter });
  const source = headerSignature(parsed.headers);
  const saved = await l.db.importMapping.findFirst({ where: { source } });
  const savedMapping = saved ? validMapping(saved.mapping, parsed.headers) : null;
  return {
    encoding: parsed.encoding,
    delimiter: parsed.delimiter,
    headers: parsed.headers,
    sample: parsed.rows.slice(0, 5),
    rowCount: parsed.rows.length,
    mapping: savedMapping ?? suggestMapping(parsed.headers, parsed.rows),
    remembered: savedMapping !== null,
  };
}

/** Mapowanie z bazy albo od klienta: tylko kolumny, które są w nagłówku pliku. */
export function validMapping(raw: unknown, headers: readonly string[]): Mapping | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Partial<Mapping>;
  if (!m.columns || typeof m.columns !== "object") return null;
  const columns = Object.fromEntries(
    Object.entries(m.columns).filter(([, v]) => typeof v === "string" && headers.includes(v)),
  );
  const dateFormat = m.dateFormat === "YMD" || m.dateFormat === "MDY" ? m.dateFormat : "DMY";
  const numberFormat = m.numberFormat === "dot" ? "dot" : "comma";
  return { columns, dateFormat, numberFormat };
}

const fingerprintOf = (accountId: string, canonical: string) =>
  createHash("sha256").update(`${accountId}\n${canonical}`).digest("hex").slice(0, 40);

interface Evaluated {
  readonly parsed: ParsedFile;
  readonly rows: PreviewRow[];
  /** Wiersze do zapisu (status ok). */
  readonly accepted: { draft: Draft; assetId: string | null; currency: string; fingerprint: string }[];
}

/** Wspólna ocena wierszy dla podglądu i importu: błędy, instrumenty, duplikaty, sprzedaż ponad stan. */
async function evaluate(
  db: Ledger["db"] | Tx,
  today: DateKey,
  file: ImportFile,
  mapping: Mapping,
): Promise<Evaluated> {
  const account = await importAccount(db, file.accountId);
  const parsed = readCsv(file.bytes, { encoding: file.encoding, delimiter: file.delimiter });
  if (!mapping.columns.date || (!mapping.columns.amount && !mapping.columns.quantity))
    throw new ImportError("mapping");
  const results = rowsToDrafts(parsed.headers, parsed.rows, mapping, {
    accountType: account.type,
    today,
    lines: parsed.lines,
  });

  // Instrumenty po tickerze albo ISIN: najpierw te, które już są na koncie, potem katalog i własne.
  const symbols = [
    ...new Set(
      results.flatMap((r) => (r.ok && isTrade(r.draft.type) && r.draft.symbol ? [r.draft.symbol] : [])),
    ),
  ];
  const assets = symbols.length
    ? await db.asset.findMany({ where: { OR: [{ symbol: { in: symbols } }, { isin: { in: symbols } }] } })
    : [];
  const held = new Set(
    (await db.holding.findMany({ where: { accountId: account.id }, select: { assetId: true } })).map(
      (h) => h.assetId,
    ),
  );
  const resolve = (symbol: string) => {
    const hits = assets.filter((a) => a.symbol?.toUpperCase() === symbol || a.isin?.toUpperCase() === symbol);
    return hits.find((a) => held.has(a.id)) ?? hits.find((a) => a.userId !== null) ?? hits[0] ?? null;
  };

  const rows: PreviewRow[] = [];
  const candidates: { index: number; draft: Draft; assetId: string | null; currency: string }[] = [];
  for (const r of results) {
    if (!r.ok) {
      rows.push({ line: r.line, status: "error", error: r.error, params: r.params });
      continue;
    }
    const d = r.draft;
    let assetId: string | null = null;
    let currency = d.currency ?? account.currency;
    if (isTrade(d.type)) {
      const asset = resolve(d.symbol!);
      if (!asset) {
        rows.push({
          line: r.line,
          status: "error",
          error: "unknownInstrument",
          params: { value: d.symbol! },
        });
        continue;
      }
      if (d.currency && d.currency !== asset.currency) {
        rows.push({ line: r.line, status: "error", error: "badCurrency", params: { value: d.currency } });
        continue;
      }
      assetId = asset.id;
      currency = asset.currency;
    }
    rows.push({
      line: r.line,
      status: "ok",
      date: d.date,
      type: d.type,
      amount: d.amount,
      currency,
      quantity: d.quantity,
      symbol: d.symbol,
      note: d.note,
    });
    candidates.push({ index: rows.length - 1, draft: d, assetId, currency });
  }

  // Odciski liczone z treści po ustaleniu instrumentu i waluty.
  const canon = canonicalRows(
    candidates.map((c) => ({ ...c.draft, currency: c.currency, symbol: c.assetId ?? c.draft.symbol })),
  );
  const prints = canon.map((c) => fingerprintOf(account.id, c));
  const existing = new Set<string>();
  for (let i = 0; i < prints.length; i += 1000) {
    const found = await db.transaction.findMany({
      where: { accountId: account.id, fingerprint: { in: prints.slice(i, i + 1000) } },
      select: { fingerprint: true },
    });
    for (const f of found) if (f.fingerprint) existing.add(f.fingerprint);
  }
  let pending = candidates.map((c, i) => ({ ...c, fingerprint: prints[i] }));
  pending = pending.filter((c) => {
    if (!existing.has(c.fingerprint)) return true;
    rows[c.index] = { ...rows[c.index], status: "duplicate" };
    return false;
  });

  // Sprzedaż ponad stan i brak kursu: symulacja FIFO na transakcjach z bazy i z pliku.
  const byAsset = new Map<string, typeof pending>();
  for (const c of pending) {
    if (!c.assetId || !isTrade(c.draft.type)) continue;
    byAsset.set(c.assetId, [...(byAsset.get(c.assetId) ?? []), c]);
  }
  const rejected = new Set<number>();
  for (const [assetId, list] of byAsset) {
    const asset = assets.find((a) => a.id === assetId)!;
    const stored = await db.transaction.findMany({
      where: { accountId: account.id, assetId, type: { in: ["BUY", "SELL"] } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });
    const fx = await loadFxTable(db, [asset.currency], today);
    const base = tradesOf(stored.map(toLedgerTx), assetId);
    let active = list;
    for (let guard = 0; guard <= list.length; guard++) {
      const trades: TradeInput[] = [
        ...base,
        ...active.map((c) => ({
          id: `row:${c.index}`,
          type: c.draft.type as "BUY" | "SELL",
          date: c.draft.date,
          quantity: c.draft.quantity!,
          price: c.draft.price!,
          fee: c.draft.fee ?? undefined,
        })),
      ];
      try {
        applyFifo(trades, { currency: asset.currency, fx });
        break;
      } catch (e) {
        const id =
          e instanceof InsufficientQuantityError
            ? e.tradeId
            : e instanceof MissingFxRateError
              ? findRow(active, e)
              : undefined;
        const index = id?.startsWith("row:") ? Number(id.slice(4)) : -1;
        if (index < 0) break;
        rows[index] =
          e instanceof InsufficientQuantityError
            ? {
                ...rows[index],
                status: "error",
                error: "insufficientQuantity",
                params: { available: e.available.toFixed(), requested: e.requested.toFixed() },
              }
            : {
                ...rows[index],
                status: "error",
                error: "missingFx",
                params: { currency: asset.currency, date: (e as MissingFxRateError).date },
              };
        rejected.add(index);
        active = active.filter((c) => c.index !== index);
      }
    }
  }
  const accepted = pending
    .filter((c) => !rejected.has(c.index))
    .map(({ draft, assetId, currency, fingerprint }) => ({ draft, assetId, currency, fingerprint }));
  return { parsed, rows, accepted };
}

/** Brak kursu dotyczy pierwszej transakcji z pliku z tą datą (transakcje z bazy mają już partie z kursem). */
function findRow(
  active: readonly { index: number; draft: Draft }[],
  e: MissingFxRateError,
): string | undefined {
  const row = active.find((c) => c.draft.date === e.date);
  return row ? `row:${row.index}` : undefined;
}

function summarize(rows: readonly PreviewRow[]): Preview {
  const count = (s: PreviewStatus) => rows.filter((r) => r.status === s).length;
  const order: Record<PreviewStatus, number> = { error: 0, duplicate: 1, ok: 2 };
  return {
    total: rows.length,
    ok: count("ok"),
    duplicates: count("duplicate"),
    errors: count("error"),
    rows: [...rows]
      .sort((a, b) => order[a.status] - order[b.status] || a.line - b.line)
      .slice(0, PREVIEW_ROWS),
  };
}

export async function previewImport(l: Ledger, file: ImportFile, mapping: Mapping): Promise<Preview> {
  const { rows } = await evaluate(l.db, l.today, file, mapping);
  return summarize(rows);
}

export interface ImportResult extends Preview {
  readonly batchId: string;
  readonly imported: number;
}

/** Import poprawnych wierszy jedną transakcją bazy; wiersze z błędami i duplikaty są pomijane. */
export async function commitImport(l: Ledger, file: ImportFile, mapping: Mapping): Promise<ImportResult> {
  return inTransaction(l, async (t) => {
    const { tx, userId } = t;
    const { parsed, rows, accepted } = await evaluate(tx, t.today, file, mapping);
    const source = headerSignature(parsed.headers);
    const batch = await tx.importBatch.create({
      data: {
        userId,
        fileName: file.fileName.slice(0, 200),
        source,
        mapping: mapping as unknown as Prisma.InputJsonValue,
        rows: rows.length,
        imported: accepted.length,
        skipped: rows.length - accepted.length,
        status: "IMPORTED",
      },
    });
    for (let i = 0; i < accepted.length; i += 1000) {
      await tx.transaction.createMany({
        data: accepted.slice(i, i + 1000).map(({ draft, assetId, currency, fingerprint }) => ({
          accountId: file.accountId,
          assetId,
          type: draft.type,
          date: dateFromKey(draft.date),
          quantity: draft.quantity,
          price: draft.price,
          fee: draft.fee,
          amount: toMoneyString(draft.amount, 4),
          currency,
          note: draft.note,
          importBatchId: batch.id,
          fingerprint,
        })),
      });
    }
    const assetIds = new Set(
      accepted.filter((a) => a.assetId && isTrade(a.draft.type)).map((a) => a.assetId!),
    );
    for (const assetId of assetIds) await rebuildHolding(t, file.accountId, assetId);
    const first = accepted.map((a) => a.draft.date).sort()[0];
    if (first) await enqueueRecalc(t, first);
    await tx.importMapping.upsert({
      where: { userId_source: { userId, source } },
      create: { userId, source, mapping: mapping as unknown as Prisma.InputJsonValue },
      update: { mapping: mapping as unknown as Prisma.InputJsonValue },
    });
    return { ...summarize(rows), batchId: batch.id, imported: accepted.length };
  });
}

/** Cofnięcie importu w ciągu 24 h (HU-2.4): usuwa jego transakcje i przelicza pozycje. */
export async function revertImport(l: Ledger, batchId: string, now = new Date()) {
  return inTransaction(l, async (t) => {
    const { tx } = t;
    const batch = await tx.importBatch.findUnique({ where: { id: batchId } });
    if (!batch || batch.status !== "IMPORTED") throw new ImportError("batch");
    if (now.getTime() - batch.createdAt.getTime() > REVERT_WINDOW_MS) throw new ImportError("revertExpired");
    const txs = await tx.transaction.findMany({ where: { importBatchId: batchId } });
    await tx.transaction.deleteMany({ where: { importBatchId: batchId } });
    const pairs = new Map<string, { accountId: string; assetId: string }>();
    for (const row of txs)
      if (row.assetId && isTrade(row.type))
        pairs.set(`${row.accountId}:${row.assetId}`, { accountId: row.accountId, assetId: row.assetId });
    for (const { accountId, assetId } of pairs.values()) {
      try {
        await rebuildHolding(t, accountId, assetId);
      } catch (e) {
        if (e instanceof LedgerError && e.code === "insufficient")
          throw new ImportError("revertBreaksSale", e.params);
        throw e;
      }
    }
    await tx.importBatch.update({
      where: { id: batchId },
      data: { status: "REVERTED", revertedAt: now },
    });
    const first = txs.map((r) => keyFromDate(r.date)).sort()[0];
    if (first) await enqueueRecalc(t, first);
    return { reverted: txs.length, accountId: txs[0]?.accountId ?? null };
  });
}

/** Ostatnie importy użytkownika do listy z przyciskiem „Cofnij” (tylko w oknie 24 h). */
export async function recentImports(l: Ledger, now = new Date()) {
  const batches = await l.db.importBatch.findMany({
    where: { createdAt: { gte: new Date(now.getTime() - 7 * REVERT_WINDOW_MS) } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return batches.map((b) => ({
    id: b.id,
    fileName: b.fileName,
    createdAt: b.createdAt.toISOString(),
    imported: b.imported,
    skipped: b.skipped,
    status: b.status,
    canRevert: b.status === "IMPORTED" && now.getTime() - b.createdAt.getTime() <= REVERT_WINDOW_MS,
  }));
}
