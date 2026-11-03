import type { AccountType, Capitalization, RetailBondType, TransactionType } from "@/generated/prisma/enums";
import { D, ZERO, type Dec } from "@/lib/money";
import {
  applyFifo,
  type AccountInput,
  type CashFlowInput,
  type DateKey,
  type PositionInput,
  type PricePoint,
  type TradeInput,
} from "@/lib/portfolio/valuation";
import { ACCOUNT_TYPES, isTrade } from "./types";

/**
 * Zamiana danych konta (transakcje, lokata, instrumenty, ceny) na wejście silnika wyceny (`AccountInput`).
 * Czysta funkcja: warstwa bazy (`load.ts`) tylko czyta rekordy i podaje je tutaj.
 *
 * Gotówka kont inwestycyjnych: kupno zużywa gotówkę tylko do wysokości salda; resztę traktujemy jak dopłatę
 * z zewnątrz. Dzięki temu konto, na którym zapisano same kupna (bez wpłat), nie ma ujemnej gotówki, a pieniądze
 * ze sprzedaży pojawiają się jako gotówka. W obrębie dnia kolejność zapisu, z kupnami na końcu dnia (kupno
 * finansują najpierw wpływy z tego samego dnia, np. wpłata zapisana po kupnie).
 */

export interface LedgerTransaction {
  readonly id: string;
  readonly type: TransactionType;
  readonly date: DateKey;
  readonly assetId: string | null;
  readonly quantity: string | null;
  readonly price: string | null;
  readonly amount: string;
  readonly currency: string;
  readonly fxRate: string | null;
  readonly fee: string | null;
}

export interface LedgerDeposit {
  readonly principal: string;
  readonly rate: string;
  readonly startDate: DateKey;
  readonly termMonths: number;
  readonly capitalization: Capitalization;
  readonly autoRenew: boolean;
}

export interface LedgerAsset {
  readonly id: string;
  readonly assetClass: string;
  readonly currency: string;
  /** Detaliczne obligacje skarbowe: typ i oprocentowanie okresów (indeks = numer okresu). */
  readonly bond?: { readonly type: RetailBondType; readonly periodRates: readonly string[] } | null;
}

export interface LedgerAccount {
  readonly id: string;
  readonly type: AccountType;
  readonly currency: string;
  readonly ownershipShare: string;
  readonly includeInNetWorth: boolean;
  readonly deposit?: LedgerDeposit | null;
  /** Transakcje konta w kolejności zapisu (data, potem utworzenie). */
  readonly transactions: readonly LedgerTransaction[];
}

export interface LedgerContext {
  readonly assets: ReadonlyMap<string, LedgerAsset>;
  readonly prices: ReadonlyMap<string, readonly PricePoint[]>;
}

/** Identyfikatory pozycji w wyniku wyceny (do łączenia z wierszami na ekranie). */
export const positionId = {
  cash: (currency: string) => `cash:${currency}`,
  asset: (assetId: string) => `asset:${assetId}`,
  bond: (assetId: string, lot: number) => `bond:${assetId}:${lot}`,
  deposit: "deposit",
  manual: "manual",
  liability: "liability",
} as const;

const dayRank = (t: LedgerTransaction): number => (t.type === "BUY" ? 1 : 0);

/** Transakcje w kolejności przetwarzania: data, potem kolejność zapisu, kupna na końcu dnia. */
export function orderForCash(txs: readonly LedgerTransaction[]): LedgerTransaction[] {
  return txs
    .map((t, i) => ({ t, i }))
    .sort(
      (a, b) =>
        (a.t.date < b.t.date ? -1 : a.t.date > b.t.date ? 1 : 0) || dayRank(a.t) - dayRank(b.t) || a.i - b.i,
    )
    .map(({ t }) => t);
}

/** Przepływy gotówki według waluty, z kupnem finansowanym najwyżej do wysokości salda. */
export function cashFlowsByCurrency(txs: readonly LedgerTransaction[]): Map<string, CashFlowInput[]> {
  const flows = new Map<string, CashFlowInput[]>();
  const balance = new Map<string, Dec>();
  for (const t of orderForCash(txs)) {
    if (t.type === "VALUATION") continue;
    const list = flows.get(t.currency) ?? [];
    flows.set(t.currency, list);
    const current = balance.get(t.currency) ?? ZERO;
    if (t.type === "BALANCE_SET") {
      list.push({ date: t.date, amount: t.amount, set: true });
      balance.set(t.currency, D(t.amount));
      continue;
    }
    let amount = D(t.amount);
    if (t.type === "BUY") {
      const available = current.gt(0) ? current : ZERO;
      amount = amount.neg().gt(available) ? available.neg() : amount;
    }
    list.push({ date: t.date, amount: amount.toFixed() });
    balance.set(t.currency, current.plus(amount));
  }
  return flows;
}

export function tradesOf(txs: readonly LedgerTransaction[], assetId: string): TradeInput[] {
  return txs
    .filter((t) => t.assetId === assetId && isTrade(t.type))
    .map((t) => ({
      id: t.id,
      type: t.type as "BUY" | "SELL",
      date: t.date,
      quantity: t.quantity ?? "0",
      price: t.price ?? "0",
      fee: t.fee ?? undefined,
      fxRate: t.fxRate ?? undefined,
    }));
}

function instrumentPositions(account: LedgerAccount, ctx: LedgerContext): PositionInput[] {
  const ids = [...new Set(account.transactions.filter((t) => isTrade(t.type)).map((t) => t.assetId!))];
  const positions: PositionInput[] = [];
  for (const assetId of ids) {
    const asset = ctx.assets.get(assetId);
    if (!asset) continue;
    const trades = tradesOf(account.transactions, assetId);
    if (asset.bond) {
      // Każda partia obligacji ma własne okresy odsetkowe liczone od daty zakupu (SPEC 7.5).
      const { lots } = applyFifo(trades, { currency: "PLN" });
      lots.forEach((lot, i) =>
        positions.push({
          id: positionId.bond(assetId, i),
          kind: "retailBond",
          assetClass: "RETAIL_BOND",
          bond: {
            type: asset.bond!.type,
            count: lot.remaining,
            purchaseDate: lot.openedAt,
            periodRates: asset.bond!.periodRates,
          },
        }),
      );
      continue;
    }
    positions.push({
      id: positionId.asset(assetId),
      kind: "market",
      assetClass: asset.assetClass,
      currency: asset.currency,
      trades,
      prices: ctx.prices.get(assetId) ?? [],
    });
  }
  return positions;
}

function cashPositions(account: LedgerAccount): PositionInput[] {
  const flows = cashFlowsByCurrency(account.transactions);
  if (!flows.has(account.currency)) flows.set(account.currency, []);
  return [...flows].map(([currency, list]) => ({
    id: positionId.cash(currency),
    kind: "cash" as const,
    assetClass: "CASH",
    currency,
    flows: list,
  }));
}

export function toAccountInput(account: LedgerAccount, ctx: LedgerContext): AccountInput {
  const info = ACCOUNT_TYPES[account.type];
  const txs = account.transactions;
  let positions: PositionInput[];
  switch (info.valuation) {
    case "cash":
      positions = cashPositions(account);
      break;
    case "investment":
      positions = [...instrumentPositions(account, ctx), ...cashPositions(account)];
      break;
    case "deposit": {
      const dep = account.deposit;
      const closedAt = txs.find((t) => t.type === "TRANSFER_OUT")?.date;
      positions = dep
        ? [
            {
              id: positionId.deposit,
              kind: "deposit",
              assetClass: "DEPOSIT",
              currency: account.currency,
              deposit: {
                principal: dep.principal,
                annualRate: dep.rate,
                startDate: dep.startDate,
                termMonths: dep.termMonths,
                capitalization: dep.capitalization,
                autoRenew: dep.autoRenew,
                closedAt,
              },
            },
          ]
        : [];
      break;
    }
    case "manual":
      positions = [
        {
          id: positionId.manual,
          kind: "manual",
          assetClass: account.type,
          currency: account.currency,
          valuations: txs
            .filter((t) => t.type === "VALUATION")
            .map((t) => ({ date: t.date, amount: t.amount })),
        },
      ];
      break;
    case "liability":
      positions = [
        {
          id: positionId.liability,
          kind: "liability",
          assetClass: "LIABILITY",
          currency: account.currency,
          balances: txs
            .filter((t) => t.type === "BALANCE_SET")
            .map((t) => ({ date: t.date, amount: t.amount })),
        },
      ];
      break;
  }
  return {
    id: account.id,
    kind: info.kind,
    ownershipShare: account.ownershipShare,
    includeInNetWorth: account.includeInNetWorth,
    positions,
  };
}
