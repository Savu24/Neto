import "server-only";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import type { AssetClass, RetailBondType } from "@/generated/prisma/enums";
import { encryptOptional } from "@/lib/crypto/fields";
import { scopedTransaction, type ScopedDb, type ScopedTx } from "@/lib/db/scoped";
import { D, toMoneyString, toQuantityString } from "@/lib/money";
import {
  addMonths,
  applyFifo,
  InsufficientQuantityError,
  MissingFxRateError,
  parseRetailBondSeries,
  RETAIL_BOND_TERMS,
  type DateKey,
  type FxTable,
} from "@/lib/portfolio/valuation";
import type { AccountInput } from "./account-input";
import type { TransactionInput } from "./input";
import { tradesOf, type LedgerTransaction } from "./positions";
import { acceptsTransfers, accountKind, allowedTransactions, isTrade, valuationOf } from "./types";

/**
 * Zapis kont, instrumentów i transakcji (HU-2.1–2.8) przez `scopedDb`. Źródłem prawdy są transakcje;
 * `Holding` i `Lot` to pamięć podręczna przeliczana tu z FIFO po każdej zmianie kupna/sprzedaży.
 * Zapis z datą wsteczną dodaje `RecalcJob` (przeliczenie migawek robi Etap 6).
 */

export type Tx = ScopedTx;

/** Kontekst zapisu: klient zawężony do użytkownika, jego id (pole wymagane przy tworzeniu) i dzisiejszy dzień. */
export interface Ledger {
  readonly db: ScopedDb;
  readonly userId: string;
  readonly today: DateKey;
}

export interface TxLedger {
  readonly tx: Tx;
  readonly userId: string;
  readonly today: DateKey;
}

export type LedgerErrorCode =
  | "notFound"
  | "archived"
  | "typeNotAllowed"
  | "insufficient"
  | "missingFx"
  | "transferTarget"
  | "transferAmount"
  | "deleteBreaksSale"
  | "assetCurrency"
  | "bondSeries"
  | "negativeBalance";

export class LedgerError extends Error {
  constructor(
    readonly code: LedgerErrorCode,
    readonly params: Record<string, string> = {},
  ) {
    super(code);
    this.name = "LedgerError";
  }
}

export const dateFromKey = (key: DateKey) => new Date(`${key}T00:00:00Z`);
export const keyFromDate = (date: Date): DateKey => date.toISOString().slice(0, 10);

/** Kursy NBP z bazy do FIFO: wszystkie punkty danych walut, do dnia `upTo`. */
export async function loadFxTable(db: ScopedDb | Tx, currencies: Iterable<string>, upTo: DateKey) {
  const list = [...new Set(currencies)].filter((c) => c !== "PLN");
  if (list.length === 0) return {} as FxTable;
  const rows = await db.fxRate.findMany({
    where: { currency: { in: list }, date: { lte: dateFromKey(upTo) } },
    orderBy: { date: "asc" },
    select: { currency: true, date: true, ratePln: true },
  });
  const table: Record<string, { date: DateKey; rate: string }[]> = {};
  for (const r of rows)
    (table[r.currency] ??= []).push({ date: keyFromDate(r.date), rate: r.ratePln.toString() });
  return table as FxTable;
}

export function toLedgerTx(t: {
  id: string;
  type: LedgerTransaction["type"];
  date: Date;
  assetId: string | null;
  quantity: { toString(): string } | null;
  price: { toString(): string } | null;
  amount: { toString(): string };
  currency: string;
  fxRate: { toString(): string } | null;
  fee: { toString(): string } | null;
}): LedgerTransaction {
  return {
    id: t.id,
    type: t.type,
    date: keyFromDate(t.date),
    assetId: t.assetId,
    quantity: t.quantity?.toString() ?? null,
    price: t.price?.toString() ?? null,
    amount: t.amount.toString(),
    currency: t.currency,
    fxRate: t.fxRate?.toString() ?? null,
    fee: t.fee?.toString() ?? null,
  };
}

/** Kolejka „przelicz od D” (SPEC 7.7): jedno zadanie oczekujące na użytkownika, z najwcześniejszą datą. */
export async function enqueueRecalc({ tx, userId, today }: TxLedger, from: DateKey) {
  if (from >= today) return;
  const pending = await tx.recalcJob.findFirst({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });
  if (!pending) {
    await tx.recalcJob.create({ data: { userId, fromDate: dateFromKey(from) } });
  } else if (keyFromDate(pending.fromDate) > from) {
    await tx.recalcJob.update({ where: { id: pending.id }, data: { fromDate: dateFromKey(from) } });
  }
}

/**
 * Przeliczenie pozycji (Holding + Lot) z transakcji kupna/sprzedaży metodą FIFO i zapis wyniku
 * zrealizowanego przy sprzedażach. Rzuca `LedgerError` przy sprzedaży ponad stan albo braku kursu.
 */
export async function rebuildHolding({ tx, today }: TxLedger, accountId: string, assetId: string) {
  const asset = await tx.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw new LedgerError("notFound");
  const rows = await tx.transaction.findMany({
    where: { accountId, assetId, type: { in: ["BUY", "SELL"] } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
  if (rows.length === 0) {
    await tx.holding.deleteMany({ where: { accountId, assetId } });
    return;
  }
  const trades = tradesOf(rows.map(toLedgerTx), assetId);
  const fx = await loadFxTable(tx, [asset.currency], today);
  let result: ReturnType<typeof applyFifo>;
  try {
    result = applyFifo(trades, { currency: asset.currency, fx });
  } catch (e) {
    if (e instanceof InsufficientQuantityError) {
      throw new LedgerError("insufficient", {
        date: e.date,
        requested: e.requested.toFixed(),
        available: e.available.toFixed(),
      });
    }
    if (e instanceof MissingFxRateError)
      throw new LedgerError("missingFx", { currency: e.currency, date: e.date });
    throw e;
  }
  const { lots, sales } = result;
  const quantity = lots.reduce((acc, l) => acc.plus(l.remaining), D(0));
  const cost = lots.reduce((acc, l) => acc.plus(l.remaining.times(l.unitCost)), D(0));
  const costBase = lots.reduce((acc, l) => acc.plus(l.remaining.times(l.unitCost).times(l.fxRate)), D(0));
  const data = {
    quantity: toQuantityString(quantity),
    costBasis: toMoneyString(cost, 4),
    costBasisBase: toMoneyString(costBase, 4),
  };
  const holding = await tx.holding.upsert({
    where: { accountId_assetId: { accountId, assetId } },
    create: { accountId, assetId, ...data },
    update: data,
  });
  await tx.lot.deleteMany({ where: { holdingId: holding.id } });
  if (lots.length > 0) {
    await tx.lot.createMany({
      data: lots.map((l) => ({
        holdingId: holding.id,
        openedAt: dateFromKey(l.openedAt),
        quantity: toQuantityString(l.quantity),
        remaining: toQuantityString(l.remaining),
        unitCost: toQuantityString(l.unitCost),
        fxRate: toQuantityString(l.fxRate),
      })),
    });
  }
  for (const sale of sales) {
    const realized = toMoneyString(sale.realizedPln, 4);
    const row = rows.find((r) => r.id === sale.tradeId);
    if (row && row.realizedPnlBase?.toString() !== D(realized).toString()) {
      await tx.transaction.update({ where: { id: row.id }, data: { realizedPnlBase: realized } });
    }
  }
}

/** Transakcja Serializable z ponowieniem przy konflikcie (dwie równoległe sprzedaże nie przekroczą stanu). */
export async function inTransaction<T>(l: Ledger, fn: (t: TxLedger) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await scopedTransaction(l.db, (tx) => fn({ tx, userId: l.userId, today: l.today }), {
        isolationLevel: "Serializable",
        timeout: 20_000,
      });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "P2034" && attempt < 3) continue;
      throw e;
    }
  }
}

// ---------- Konta ----------

async function writeAccountDetails(tx: Tx, accountId: string, input: AccountInput) {
  if (input.deposit) {
    const d = input.deposit;
    if (d.payoutAccountId) {
      const payout = await tx.financialAccount.findUnique({ where: { id: d.payoutAccountId } });
      if (!payout || payout.id === accountId || !acceptsTransfers(payout.type))
        throw new LedgerError("transferTarget");
    }
    const data = {
      principal: d.principal,
      rate: d.rate,
      startDate: dateFromKey(d.startDate),
      termMonths: d.termMonths,
      capitalization: d.capitalization,
      autoRenew: d.autoRenew,
      payoutAccountId: d.payoutAccountId,
    };
    await tx.deposit.upsert({ where: { accountId }, create: { accountId, ...data }, update: data });
  }
  if (input.liability) {
    const l = input.liability;
    const data = {
      interestRate: l.interestRate,
      monthlyPayment: l.monthlyPayment,
      endDate: l.endDate ? dateFromKey(l.endDate) : null,
      originalAmount: l.originalAmount,
    };
    await tx.liability.upsert({ where: { accountId }, create: { accountId, ...data }, update: data });
  }
}

export async function createAccount(l: Ledger, input: AccountInput) {
  return inTransaction(l, async (t) => {
    const { tx, userId } = t;
    const count = await tx.financialAccount.count();
    const account = await tx.financialAccount.create({
      data: {
        userId,
        name: input.name,
        kind: accountKind(input.type),
        type: input.type,
        currency: input.currency,
        institution: input.institution,
        taxWrapper: input.taxWrapper,
        ownershipShare: input.ownershipShare,
        includeInNetWorth: input.includeInNetWorth,
        notesEnc: encryptOptional(input.notes),
        sortOrder: count,
      },
    });
    await writeAccountDetails(tx, account.id, input);
    if (input.opening) {
      const type = valuationOf(input.type) === "manual" ? "VALUATION" : "BALANCE_SET";
      await tx.transaction.create({
        data: {
          accountId: account.id,
          type,
          date: dateFromKey(input.opening.date),
          amount: toMoneyString(input.opening.amount, 4),
          currency: input.currency,
        },
      });
      await enqueueRecalc(t, input.opening.date);
    }
    if (input.deposit) await enqueueRecalc(t, input.deposit.startDate);
    return account;
  });
}

export async function updateAccount(l: Ledger, accountId: string, input: AccountInput) {
  return inTransaction(l, async (t) => {
    const { tx } = t;
    const current = await tx.financialAccount.findUnique({ where: { id: accountId } });
    if (!current) throw new LedgerError("notFound");
    await tx.financialAccount.update({
      where: { id: accountId },
      data: {
        name: input.name,
        institution: input.institution,
        taxWrapper: input.taxWrapper,
        ownershipShare: input.ownershipShare,
        includeInNetWorth: input.includeInNetWorth,
        notesEnc: encryptOptional(input.notes),
      },
    });
    await writeAccountDetails(tx, accountId, input);
    // Udział własności, wliczanie i parametry lokaty zmieniają całą historię konta.
    const first = await tx.transaction.findFirst({ where: { accountId }, orderBy: { date: "asc" } });
    const from = [first ? keyFromDate(first.date) : null, input.deposit?.startDate ?? null]
      .filter((d): d is DateKey => d !== null)
      .sort()[0];
    if (from) await enqueueRecalc(t, from);
  });
}

/** Archiwizacja (HU-2.8): konto znika z bieżącego widoku, historia zostaje. */
export async function setArchived(l: Ledger, accountId: string, archived: boolean) {
  const res = await l.db.financialAccount.updateMany({
    where: { id: accountId },
    data: { archivedAt: archived ? new Date() : null },
  });
  if (res.count === 0) throw new LedgerError("notFound");
}

// ---------- Instrumenty ----------

export interface ManualAssetInput {
  readonly name: string;
  readonly symbol: string | null;
  readonly isin: string | null;
  readonly assetClass: AssetClass;
  readonly currency: string;
}

/** Instrument ręczny użytkownika (HU-2.2: „Dodaj instrument ręcznie”); cenę podaje się osobno. */
export async function createManualAsset(l: Ledger, input: ManualAssetInput) {
  return l.db.asset.create({
    data: {
      userId: l.userId,
      name: input.name,
      symbol: input.symbol,
      isin: input.isin,
      assetClass: input.assetClass,
      currency: input.currency,
      priceSource: "MANUAL",
    },
  });
}

/**
 * Ręczna cena instrumentu własnego. `PriceSnapshot` jest tabelą globalną (scopedDb: tylko odczyt),
 * więc po sprawdzeniu przez scopedDb, że instrument należy do użytkownika i ma cenę ręczną, zapis robi
 * surowy klient. Ceny katalogu wspólnego zapisuje tylko cron dostawcy (Etap 6).
 */
export async function setManualPrice(
  l: Ledger,
  base: PrismaClient,
  assetId: string,
  date: DateKey,
  close: string,
) {
  const asset = await l.db.asset.findFirst({
    where: { id: assetId, userId: l.userId, priceSource: "MANUAL" },
  });
  if (!asset) throw new LedgerError("notFound");
  await base.priceSnapshot.upsert({
    where: { assetId_date: { assetId, date: dateFromKey(date) } },
    create: { assetId, date: dateFromKey(date), close, currency: asset.currency, source: "manual" },
    update: { close, fetchedAt: new Date() },
  });
  await inTransaction(l, (t) => enqueueRecalc(t, date));
}

/**
 * Seria detalicznych obligacji skarbowych (SPEC 7.5) jako instrument własny użytkownika.
 * Ta sama seria zakładana drugi raz zwraca istniejący instrument (oprocentowanie okresów jest wspólne dla serii).
 */
export async function ensureBondSeries(l: Ledger, code: string, firstRate: string | null) {
  const parsed = parseRetailBondSeries(code);
  if (!parsed) throw new LedgerError("bondSeries");
  const symbol = code.trim().toUpperCase();
  const existing = await l.db.asset.findFirst({
    where: { symbol, assetClass: "RETAIL_BOND", userId: l.userId },
  });
  if (existing) return existing;
  if (firstRate === null) throw new LedgerError("bondSeries");
  const term = RETAIL_BOND_TERMS[parsed.type];
  const issueMonth = addMonths(`${parsed.maturityMonth}-01`, -term.months);
  return inTransaction(l, async ({ tx, userId }) => {
    const asset = await tx.asset.create({
      data: {
        userId,
        name: symbol,
        symbol,
        assetClass: "RETAIL_BOND",
        currency: "PLN",
        priceSource: "MANUAL",
      },
    });
    await tx.retailBondSeries.create({
      data: {
        assetId: asset.id,
        bondType: parsed.type as RetailBondType,
        issueMonth: dateFromKey(issueMonth),
        periodRates: [{ from: issueMonth, rate: firstRate }],
      },
    });
    return asset;
  });
}

export type PeriodRate = { from: DateKey; rate: string };

/** Oprocentowanie kolejnych okresów serii (w 1.0 wpisywane ręcznie). Indeks w tablicy = numer okresu. */
export async function setBondRates(l: Ledger, assetId: string, rates: readonly string[]) {
  const series = await l.db.retailBondSeries.findFirst({
    where: { assetId, asset: { userId: l.userId } },
  });
  if (!series) throw new LedgerError("notFound");
  const term = RETAIL_BOND_TERMS[series.bondType];
  const issue = keyFromDate(series.issueMonth);
  const periodRates: PeriodRate[] = rates.map((rate, i) => ({
    from: addMonths(issue, i * term.periodMonths),
    rate,
  }));
  await inTransaction(l, async (t) => {
    await t.tx.retailBondSeries.update({ where: { assetId }, data: { periodRates } });
    await enqueueRecalc(t, issue);
  });
}

export function bondRatesOf(periodRates: unknown): string[] {
  if (!Array.isArray(periodRates)) return [];
  return [...(periodRates as PeriodRate[])]
    .filter((p) => p && typeof p.rate === "string")
    .sort((a, b) => (a.from < b.from ? -1 : 1))
    .map((p) => p.rate);
}

// ---------- Transakcje ----------

/** Zapis transakcji (HU-2.3) z przeliczeniem pozycji i kolejką przeliczeń. Zwraca id zapisanej transakcji. */
export async function recordTransaction(l: Ledger, input: TransactionInput) {
  return inTransaction(l, (t) => writeTransaction(t, input));
}

export async function writeTransaction(
  t: TxLedger,
  input: TransactionInput,
  extra: { importBatchId?: string; fingerprint?: string; skipRebuild?: boolean } = {},
) {
  const { tx } = t;
  const account = await tx.financialAccount.findUnique({ where: { id: input.accountId } });
  if (!account) throw new LedgerError("notFound");
  if (account.archivedAt) throw new LedgerError("archived");
  if (!allowedTransactions(account.type).includes(input.type)) throw new LedgerError("typeNotAllowed");
  if (input.type === "BALANCE_SET" && valuationOf(account.type) === "liability" && D(input.amount).isNeg())
    throw new LedgerError("negativeBalance");

  let currency = input.currency ?? account.currency;
  if (input.assetId) {
    const asset = await tx.asset.findUnique({ where: { id: input.assetId } });
    if (!asset) throw new LedgerError("notFound");
    if (isTrade(input.type)) {
      if (input.currency && input.currency !== asset.currency) throw new LedgerError("assetCurrency");
      currency = asset.currency;
    }
  }

  const transferGroupId = input.type === "TRANSFER_OUT" ? randomUUID() : null;
  const created = await tx.transaction.create({
    data: {
      accountId: account.id,
      assetId: input.assetId,
      type: input.type,
      date: dateFromKey(input.date),
      quantity: input.quantity,
      price: input.price,
      amount: toMoneyString(input.amount, 4),
      currency,
      fxRate: input.fxRate,
      fee: input.fee,
      note: input.note,
      transferGroupId,
      importBatchId: extra.importBatchId,
      fingerprint: extra.fingerprint,
    },
  });

  if (transferGroupId) {
    const target = input.toAccountId
      ? await tx.financialAccount.findUnique({ where: { id: input.toAccountId } })
      : null;
    if (!target || target.archivedAt || target.id === account.id || !acceptsTransfers(target.type))
      throw new LedgerError("transferTarget");
    if (target.currency !== currency && !input.toAmount) throw new LedgerError("transferAmount");
    await tx.transaction.create({
      data: {
        accountId: target.id,
        type: "TRANSFER_IN",
        date: dateFromKey(input.date),
        amount: toMoneyString(input.toAmount ?? D(input.amount).neg(), 4),
        currency: target.currency,
        note: input.note,
        transferGroupId,
      },
    });
  }

  if (isTrade(input.type) && !extra.skipRebuild) await rebuildHolding(t, account.id, input.assetId!);
  await enqueueRecalc(t, input.date);
  return created.id;
}

/**
 * Usunięcie transakcji (z drugą stroną przelewu). Nie pozwala usunąć kupna, którego potrzebuje
 * późniejsza sprzedaż. Zwraca id konta.
 */
export async function deleteTransaction(l: Ledger, transactionId: string) {
  return inTransaction(l, async (t) => {
    const { tx } = t;
    const row = await tx.transaction.findUnique({ where: { id: transactionId } });
    if (!row) throw new LedgerError("notFound");
    const group = row.transferGroupId
      ? await tx.transaction.findMany({ where: { transferGroupId: row.transferGroupId } })
      : [row];
    await tx.transaction.deleteMany({ where: { id: { in: group.map((g) => g.id) } } });
    if (isTrade(row.type) && row.assetId) {
      try {
        await rebuildHolding(t, row.accountId, row.assetId);
      } catch (e) {
        if (e instanceof LedgerError && e.code === "insufficient")
          throw new LedgerError("deleteBreaksSale", e.params);
        throw e;
      }
    }
    await enqueueRecalc(t, keyFromDate(row.date));
    return row.accountId;
  });
}
