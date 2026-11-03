import "server-only";
import type {
  AccountKind,
  AccountType,
  Capitalization,
  RetailBondType,
  TaxWrapper,
} from "@/generated/prisma/enums";
import { decryptOptional } from "@/lib/crypto/fields";
import type { ScopedDb } from "@/lib/db/scoped";
import { D, sum, ZERO, type Dec } from "@/lib/money";
import {
  netWorthAt,
  positionResult,
  type AccountValuation,
  type DateKey,
  type FxTable,
  type Lot,
  type PositionValuation,
  type PricePoint,
} from "@/lib/portfolio/valuation";
import { positionId, toAccountInput, type LedgerAsset, type LedgerTransaction } from "./positions";
import { bondRatesOf, dateFromKey, keyFromDate, toLedgerTx } from "./service";
import { ACCOUNT_TYPES, valuationOf, type AccountGroup } from "./types";

/**
 * Model odczytu ekranów Majątek, konta i pozycji: rekordy z bazy (przez scopedDb) → silnik wyceny →
 * zwykłe obiekty z kwotami jako napisy (do komponentów serwerowych i klienckich).
 * Wartości bieżące liczone z ostatnich cen i kursów w bazie; brak ceny/kursu to `null`, nie zero.
 */

export interface PositionView {
  readonly id: string;
  readonly kind: PositionValuation["kind"];
  readonly assetId: string | null;
  readonly name: string;
  readonly symbol: string | null;
  readonly assetClass: string;
  readonly currency: string;
  readonly quantity: string | null;
  readonly price: string | null;
  readonly priceDate: DateKey | null;
  /** Brak notowania w bazie: wartość z ceny ostatniej transakcji (oznaczenie „brak wyceny”). */
  readonly priceFromTrade: boolean;
  readonly value: string | null;
  readonly valuePln: string | null;
  readonly costPln: string | null;
  readonly resultPln: string | null;
  readonly resultPercent: string | null;
  readonly fxRate: string | null;
  readonly fxDate: DateKey | null;
  readonly stale: { readonly sourceDate: DateKey; readonly age: number } | null;
  readonly missingPrice: boolean;
  readonly missingFx: boolean;
  readonly checkRate: boolean;
  readonly bondRateMissing: boolean;
  /** Lokata i obligacje: termin. */
  readonly maturityDate: DateKey | null;
}

export interface AccountView {
  readonly id: string;
  readonly name: string;
  readonly type: AccountType;
  readonly kind: AccountKind;
  readonly group: AccountGroup;
  readonly currency: string;
  readonly institution: string | null;
  readonly taxWrapper: TaxWrapper;
  readonly ownershipShare: string;
  readonly includeInNetWorth: boolean;
  readonly archived: boolean;
  /** Wartość w PLN po udziale własności (dodatnia także dla zobowiązań). */
  readonly valuePln: string;
  readonly complete: boolean;
  readonly costPln: string | null;
  readonly resultPercent: string | null;
  readonly positions: readonly PositionView[];
  readonly deposit: {
    readonly principal: string;
    readonly rate: string;
    readonly startDate: DateKey;
    readonly termMonths: number;
    readonly capitalization: Capitalization;
    readonly autoRenew: boolean;
    readonly payoutAccountId: string | null;
    readonly closed: boolean;
  } | null;
  readonly liability: {
    readonly interestRate: string | null;
    readonly monthlyPayment: string | null;
    readonly endDate: DateKey | null;
    readonly originalAmount: string | null;
  } | null;
}

export interface PortfolioView {
  readonly date: DateKey;
  readonly assets: string;
  readonly liabilities: string;
  readonly netWorth: string;
  readonly accounts: readonly AccountView[];
  readonly archivedCount: number;
  readonly staleCount: number;
}

type AssetRow = {
  id: string;
  name: string;
  symbol: string | null;
  isin: string | null;
  assetClass: string;
  currency: string;
  retailBondSeries: { bondType: RetailBondType; periodRates: unknown } | null;
};

export function toLedgerAsset(a: AssetRow): LedgerAsset {
  return {
    id: a.id,
    assetClass: a.assetClass,
    currency: a.currency,
    bond: a.retailBondSeries
      ? { type: a.retailBondSeries.bondType, periodRates: bondRatesOf(a.retailBondSeries.periodRates) }
      : null,
  };
}

/** Ostatnia cena ≤ D per instrument (do wyceny bieżącej wystarczy jedna); zapytanie po indeksie (assetId, date DESC). */
async function latestPrices(db: ScopedDb, assetIds: string[], date: DateKey) {
  const rows = await Promise.all(
    assetIds.map((assetId) =>
      db.priceSnapshot.findFirst({
        where: { assetId, date: { lte: dateFromKey(date) } },
        orderBy: { date: "desc" },
      }),
    ),
  );
  const map = new Map<string, PricePoint[]>();
  for (const r of rows) if (r) map.set(r.assetId, [{ date: keyFromDate(r.date), close: r.close.toString() }]);
  return map;
}

/** Ostatni kurs ≤ D per waluta. */
export async function latestFx(db: ScopedDb, currencies: Iterable<string>, date: DateKey): Promise<FxTable> {
  const list = [...new Set(currencies)].filter((c) => c !== "PLN");
  if (list.length === 0) return {};
  const rows = await Promise.all(
    list.map((currency) =>
      db.fxRate.findFirst({
        where: { currency, date: { lte: dateFromKey(date) } },
        orderBy: { date: "desc" },
      }),
    ),
  );
  return Object.fromEntries(
    rows
      .filter((r) => r !== null)
      .map((r) => [r.currency, [{ date: keyFromDate(r.date), rate: r.ratePln.toString() }]]),
  );
}

export function lotsFromRows(
  rows: readonly {
    openedAt: Date;
    quantity: Dec | { toString(): string };
    remaining: { toString(): string };
    unitCost: { toString(): string };
    fxRate: { toString(): string };
  }[],
): Lot[] {
  return rows.map((l) => ({
    openedAt: keyFromDate(l.openedAt),
    quantity: D(l.quantity.toString()),
    remaining: D(l.remaining.toString()),
    unitCost: D(l.unitCost.toString()),
    fxRate: D(l.fxRate.toString()),
  }));
}

const str = (d: Dec | null | undefined) => (d ? d.toFixed() : null);

function viewPosition(
  p: PositionValuation,
  assets: ReadonlyMap<string, AssetRow>,
  lots: ReadonlyMap<string, Lot[]>,
  share: Dec,
): PositionView {
  const [prefix, assetId] = p.id?.split(":") ?? [];
  const asset = prefix === "asset" || prefix === "bond" ? assets.get(assetId) : undefined;
  const stale = p.issues.find((i) => i.type === "stale" && i.staleness.kind !== "fx");
  let costPln: Dec | null = null;
  let resultPln: Dec | null = null;
  let resultPercent: Dec | null = null;
  if (p.kind === "market" && asset && p.price && p.fxRate) {
    const r = positionResult({ lots: lots.get(asset.id) ?? [], price: p.price, fxRate: p.fxRate });
    costPln = r.costPln.times(share);
    resultPln = r.totalPln.times(share);
    resultPercent = r.totalPercent;
  }
  return {
    id: p.id ?? "",
    kind: p.kind,
    assetId: asset?.id ?? null,
    name: asset?.name ?? p.currency,
    symbol: asset?.symbol ?? null,
    assetClass: p.assetClass,
    currency: p.currency,
    quantity: p.kind === "retailBond" ? null : str(p.quantity),
    price: str(p.price),
    priceDate: p.kind === "market" && !p.priceFromTrade ? p.sourceDate : null,
    priceFromTrade: p.priceFromTrade ?? false,
    value: str(p.value),
    valuePln: str(p.valuePln),
    costPln: str(costPln),
    resultPln: str(resultPln),
    resultPercent: str(resultPercent),
    fxRate: str(p.fxRate),
    fxDate: p.fxDate,
    stale:
      stale && stale.type === "stale"
        ? { sourceDate: stale.staleness.sourceDate, age: stale.staleness.age }
        : null,
    missingPrice: p.issues.some((i) => i.type === "missingPrice") || (p.priceFromTrade ?? false),
    missingFx: p.issues.some((i) => i.type === "missingFx"),
    checkRate: p.issues.some((i) => i.type === "depositCheckRate"),
    bondRateMissing: p.issues.some((i) => i.type === "bondRateMissing"),
    maturityDate: p.deposit?.maturityDate ?? p.bond?.maturityDate ?? null,
  };
}

/** Obligacje: partie tej samej serii łączymy w jeden wiersz (wartości się sumują). */
function mergeBondLots(positions: PositionView[], bondCounts: ReadonlyMap<string, Dec>): PositionView[] {
  const out: PositionView[] = [];
  const byAsset = new Map<string, PositionView>();
  for (const p of positions) {
    if (p.kind !== "retailBond" || !p.assetId) {
      out.push(p);
      continue;
    }
    const prev = byAsset.get(p.assetId);
    const merged: PositionView = prev
      ? {
          ...prev,
          value: prev.value && p.value ? D(prev.value).plus(p.value).toFixed() : null,
          valuePln: prev.valuePln && p.valuePln ? D(prev.valuePln).plus(p.valuePln).toFixed() : null,
          bondRateMissing: prev.bondRateMissing || p.bondRateMissing,
          maturityDate:
            prev.maturityDate && p.maturityDate && prev.maturityDate < p.maturityDate
              ? prev.maturityDate
              : p.maturityDate,
        }
      : { ...p, id: positionId.asset(p.assetId), quantity: bondCounts.get(p.assetId)?.toFixed() ?? null };
    if (prev) out[out.indexOf(prev)] = merged;
    else out.push(merged);
    byAsset.set(p.assetId, merged);
  }
  return out;
}

/** Pozycje bez znaczenia na liście: sprzedane do zera i pusta gotówka w walucie innej niż waluta konta. */
function visible(p: PositionView, accountCurrency: string): boolean {
  if (p.kind === "cash") return p.currency === accountCurrency || (p.value !== null && !D(p.value).isZero());
  if (p.kind === "market") return p.quantity === null || !D(p.quantity).isZero();
  if (p.kind === "retailBond") return p.value === null || !D(p.value).isZero();
  return true;
}

/** Wiersz konta z bazy (z lokatą) → wejście silnika wyceny. Wspólne dla wyceny bieżącej i historii. */
export function accountInputOf(
  a: {
    id: string;
    type: AccountType;
    currency: string;
    ownershipShare: { toString(): string };
    includeInNetWorth: boolean;
    deposit: {
      principal: { toString(): string };
      rate: { toString(): string };
      startDate: Date;
      termMonths: number;
      capitalization: Capitalization;
      autoRenew: boolean;
    } | null;
  },
  transactions: LedgerTransaction[],
  ctx: { assets: ReadonlyMap<string, LedgerAsset>; prices: ReadonlyMap<string, readonly PricePoint[]> },
) {
  return toAccountInput(
    {
      id: a.id,
      type: a.type,
      currency: a.currency,
      ownershipShare: a.ownershipShare.toString(),
      includeInNetWorth: a.includeInNetWorth,
      deposit: a.deposit
        ? {
            principal: a.deposit.principal.toString(),
            rate: a.deposit.rate.toString(),
            startDate: keyFromDate(a.deposit.startDate),
            termMonths: a.deposit.termMonths,
            capitalization: a.deposit.capitalization,
            autoRenew: a.deposit.autoRenew,
          }
        : null,
      transactions,
    },
    ctx,
  );
}

export interface LoadOptions {
  readonly archived?: boolean;
  readonly accountId?: string;
}

export async function loadPortfolio(
  db: ScopedDb,
  today: DateKey,
  opts: LoadOptions = {},
): Promise<PortfolioView> {
  const accounts = await db.financialAccount.findMany({
    where: {
      ...(opts.accountId ? { id: opts.accountId } : { archivedAt: opts.archived ? { not: null } : null }),
    },
    include: { deposit: true, liability: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const archivedCount = opts.accountId
    ? 0
    : await db.financialAccount.count({ where: { archivedAt: { not: null } } });
  const ids = accounts.map((a) => a.id);
  const [txRows, holdings] = await Promise.all([
    db.transaction.findMany({
      where: { accountId: { in: ids }, date: { lte: dateFromKey(today) } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    db.holding.findMany({ where: { accountId: { in: ids } }, include: { lots: true } }),
  ]);
  const assetIds = [...new Set(txRows.map((t) => t.assetId).filter((x): x is string => x !== null))];
  const assetRows = assetIds.length
    ? await db.asset.findMany({ where: { id: { in: assetIds } }, include: { retailBondSeries: true } })
    : [];
  const assets = new Map(assetRows.map((a) => [a.id, a as AssetRow]));
  const prices = await latestPrices(db, assetIds, today);
  const currencies = [
    ...accounts.map((a) => a.currency),
    ...txRows.map((t) => t.currency),
    ...assetRows.map((a) => a.currency),
  ];
  const fx = await latestFx(db, currencies, today);

  const txByAccount = new Map<string, LedgerTransaction[]>();
  for (const t of txRows) {
    const list = txByAccount.get(t.accountId) ?? [];
    list.push(toLedgerTx(t));
    txByAccount.set(t.accountId, list);
  }
  const ledgerAssets = new Map(assetRows.map((a) => [a.id, toLedgerAsset(a as AssetRow)]));
  const inputs = accounts.map((a) =>
    accountInputOf(a, txByAccount.get(a.id) ?? [], { assets: ledgerAssets, prices }),
  );
  const result = netWorthAt(inputs, today, fx);

  const lotsByKey = new Map<string, Map<string, Lot[]>>();
  const bondCounts = new Map<string, Dec>();
  for (const h of holdings) {
    const m = lotsByKey.get(h.accountId) ?? new Map<string, Lot[]>();
    m.set(h.assetId, lotsFromRows(h.lots));
    lotsByKey.set(h.accountId, m);
    if (assets.get(h.assetId)?.retailBondSeries)
      bondCounts.set(`${h.accountId}:${h.assetId}`, D(h.quantity.toString()));
  }

  const views = accounts.map((a, i): AccountView => {
    const valuation: AccountValuation = result.accounts[i];
    const lots = lotsByKey.get(a.id) ?? new Map();
    const counts = new Map(
      [...bondCounts].filter(([k]) => k.startsWith(`${a.id}:`)).map(([k, v]) => [k.split(":")[1], v]),
    );
    const positions = mergeBondLots(
      valuation.positions.map((p) => viewPosition(p, assets, lots, valuation.ownershipShare)),
      counts,
    ).filter((p) => visible(p, a.currency));
    const market = positions.filter((p) => p.kind === "market" && p.costPln !== null);
    const cost = market.length ? sum(market.map((p) => p.costPln!)) : null;
    const res = market.length ? sum(market.map((p) => p.resultPln!)) : null;
    const closed =
      a.type === "DEPOSIT" && (txByAccount.get(a.id) ?? []).some((t) => t.type === "TRANSFER_OUT");
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      kind: a.kind,
      group: ACCOUNT_TYPES[a.type].group,
      currency: a.currency,
      institution: a.institution,
      taxWrapper: a.taxWrapper,
      ownershipShare: a.ownershipShare.toString(),
      includeInNetWorth: a.includeInNetWorth,
      archived: a.archivedAt !== null,
      valuePln: valuation.valuePln.toFixed(),
      complete: valuation.complete,
      costPln: str(cost),
      resultPercent: cost && res && cost.gt(ZERO) ? res.div(cost).toFixed() : null,
      positions,
      deposit: a.deposit
        ? {
            principal: a.deposit.principal.toString(),
            rate: a.deposit.rate.toString(),
            startDate: keyFromDate(a.deposit.startDate),
            termMonths: a.deposit.termMonths,
            capitalization: a.deposit.capitalization,
            autoRenew: a.deposit.autoRenew,
            payoutAccountId: a.deposit.payoutAccountId,
            closed,
          }
        : null,
      liability: a.liability
        ? {
            interestRate: a.liability.interestRate?.toString() ?? null,
            monthlyPayment: a.liability.monthlyPayment?.toString() ?? null,
            endDate: a.liability.endDate ? keyFromDate(a.liability.endDate) : null,
            originalAmount: a.liability.originalAmount?.toString() ?? null,
          }
        : null,
    };
  });

  return {
    date: today,
    assets: result.assets.toFixed(),
    liabilities: result.liabilities.toFixed(),
    netWorth: result.netWorth.toFixed(),
    accounts: views,
    archivedCount,
    staleCount: result.staleCount,
  };
}

/** Notatka konta (pole szyfrowane) — tylko dla formularza edycji. */
export async function loadAccountForEdit(db: ScopedDb, accountId: string) {
  const a = await db.financialAccount.findUnique({
    where: { id: accountId },
    include: { deposit: true, liability: true },
  });
  if (!a) return null;
  return { ...a, notes: decryptOptional(a.notesEnc) };
}

export function isInvestment(type: AccountType) {
  return valuationOf(type) === "investment";
}
