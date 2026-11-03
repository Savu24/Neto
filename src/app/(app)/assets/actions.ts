"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AssetClass } from "@/generated/prisma/enums";
import { getLocale, getT } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { scopedDb } from "@/lib/db/scoped";
import { formatDate, formatNumber } from "@/lib/format";
import { D } from "@/lib/money";
import { searchInstruments, type InstrumentHit } from "@/lib/portfolio/catalog/search";
import { parseUserNumber } from "@/lib/portfolio/import/numbers";
import { AccountInputError, parseAccountInput } from "@/lib/portfolio/ledger/account-input";
import { InputError, parseDateField, parseTransactionInput } from "@/lib/portfolio/ledger/input";
import {
  createAccount,
  createManualAsset,
  deleteTransaction,
  ensureBondSeries,
  LedgerError,
  recordTransaction,
  setArchived,
  setBondRates,
  setManualPrice,
  updateAccount,
  type Ledger,
} from "@/lib/portfolio/ledger/service";
import { todayKey } from "@/lib/portfolio/valuation";

/**
 * Akcje ekranów Majątek i Dodaj (HU-2.1–2.8). Każda woła requireUser() i pisze wyłącznie przez scopedDb
 * (ceny ręczne: patrz `setManualPrice`). Błędy wracają jako przetłumaczony tekst z polem, którego dotyczą.
 */

/** `values`: wysłane pola przy błędzie, żeby formularz po resecie (React 19) pokazał to, co wpisano. */
export type ActionState =
  { error?: string; message?: string; field?: string; values?: Record<string, string> } | undefined;

async function ledger(): Promise<Ledger> {
  const { user } = await requireUser();
  return { db: scopedDb(db(), user.id), userId: user.id, today: todayKey() };
}

function fields(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

/** Parametry komunikatów: daty i liczby w formacie języka użytkownika. */
async function formatParams(params: Record<string, string>) {
  const locale = await getLocale();
  return Object.fromEntries(
    Object.entries(params).map(([k, v]) => [
      k,
      /^\d{4}-\d{2}-\d{2}$/.test(v)
        ? formatDate(v, locale)
        : /^-?\d+(\.\d+)?$/.test(v)
          ? formatNumber(v, locale, 10)
          : v,
    ]),
  );
}

async function errorState(e: unknown, values?: Record<string, string>): Promise<ActionState> {
  return { ...(await errorMessage(e)), values };
}

async function errorMessage(e: unknown): Promise<ActionState> {
  if (e instanceof AccountInputError) {
    return { error: (await getT("assets"))(`err_${e.code}`), field: e.field };
  }
  if (e instanceof InputError) {
    return { error: (await getT("transactions"))(`err_${e.code}`), field: e.field };
  }
  if (e instanceof LedgerError) {
    return { error: (await getT("transactions"))(`err_${e.code}`, await formatParams(e.params)) };
  }
  console.error(e);
  return { error: (await getT("transactions"))("err_generic") };
}

function refresh() {
  revalidatePath("/", "layout");
}

// ---------- Konta ----------

export async function createAccountAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const l = await ledger();
  const f = fields(fd);
  let id: string;
  try {
    const input = parseAccountInput(f, l.today, "create");
    id = (await createAccount(l, input)).id;
  } catch (e) {
    if (e instanceof LedgerError && e.code === "transferTarget")
      return { error: (await getT("assets"))("err_transferTarget"), field: "payoutAccountId", values: f };
    return errorState(e, f);
  }
  refresh();
  redirect(`/assets/${id}`);
}

export async function updateAccountAction(
  accountId: string,
  _: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const l = await ledger();
  const f = fields(fd);
  try {
    const current = await l.db.financialAccount.findUnique({ where: { id: accountId } });
    if (!current) return { error: (await getT("assets"))("err_notFound") };
    await updateAccount(l, accountId, parseAccountInput(f, l.today, "edit", current.type));
  } catch (e) {
    if (e instanceof LedgerError && e.code === "transferTarget")
      return { error: (await getT("assets"))("err_transferTarget"), field: "payoutAccountId", values: f };
    return errorState(e, f);
  }
  refresh();
  redirect(`/assets/${accountId}`);
}

export async function archiveAccountAction(fd: FormData) {
  const l = await ledger();
  const accountId = String(fd.get("accountId") ?? "");
  const archived = fd.get("archived") === "1";
  await setArchived(l, accountId, archived);
  refresh();
  redirect(archived ? "/assets" : `/assets/${accountId}`);
}

// ---------- Transakcje ----------

export async function recordTransactionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const l = await ledger();
  const f = fields(fd);
  try {
    if (f.mode === "bond") {
      // Obligacje skarbowe: seria z kodu, cena domyślnie 100 zł (SPEC 7.5).
      const firstRateRaw = f.firstRate?.trim() ? parseUserNumber(f.firstRate) : null;
      if (f.firstRate?.trim() && (firstRateRaw === null || D(firstRateRaw).lt(0) || D(firstRateRaw).gt(100)))
        throw new LedgerError("bondSeries");
      const firstRate = firstRateRaw === null ? null : D(firstRateRaw).div(100).toFixed();
      const series = await ensureBondSeries(l, f.series ?? "", firstRate);
      f.assetId = series.id;
      f.price = f.price?.trim() || "100";
    }
    const input = parseTransactionInput(f, l.today);
    await recordTransaction(l, input);
  } catch (e) {
    return errorState(e, f);
  }
  refresh();
  redirect(
    `/assets/${f.accountId}${f.assetId && f.mode !== "bond" && f.returnTo === "position" ? `/${f.assetId}` : ""}`,
  );
}

export async function deleteTransactionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const l = await ledger();
  try {
    await deleteTransaction(l, String(fd.get("transactionId") ?? ""));
  } catch (e) {
    return errorState(e);
  }
  refresh();
  return { message: (await getT("transactions"))("deleted") };
}

/** Zakończenie lokaty (SPEC 7.4): przelew kwoty z terminu na konto wypłaty. */
export async function closeDepositAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const l = await ledger();
  const f = fields(fd);
  try {
    const input = parseTransactionInput({ ...f, type: "TRANSFER_OUT" }, l.today);
    await recordTransaction(l, input);
  } catch (e) {
    return errorState(e, f);
  }
  refresh();
  redirect(`/assets/${f.accountId}`);
}

// ---------- Instrumenty ----------

export async function searchInstrumentsAction(query: string): Promise<InstrumentHit[]> {
  const l = await ledger();
  return searchInstruments(l.db, query);
}

const CLASSES: readonly AssetClass[] = ["EQUITY", "ETF", "FUND", "BOND", "CRYPTO", "COMMODITY", "OTHER"];

export type ManualAssetState = NonNullable<ActionState> & { asset?: InstrumentHit };

export async function createManualAssetAction(
  _: ManualAssetState | undefined,
  fd: FormData,
): Promise<ManualAssetState> {
  const l = await ledger();
  const f = fields(fd);
  const t = await getT("transactions");
  const name = f.name?.trim() ?? "";
  if (!name || name.length > 120) return { error: t("err_manualName"), field: "name" };
  const currency = (f.currency?.trim() || "PLN").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return { error: t("err_currency"), field: "currency" };
  const assetClass = CLASSES.includes(f.assetClass as AssetClass) ? (f.assetClass as AssetClass) : "OTHER";
  const price = f.price?.trim() ? parseUserNumber(f.price) : null;
  if (f.price?.trim() && (price === null || D(price).lte(0)))
    return { error: t("err_price"), field: "price" };
  try {
    const asset = await createManualAsset(l, {
      name,
      symbol: f.symbol?.trim().toUpperCase().slice(0, 20) || null,
      isin: f.isin?.trim().toUpperCase().slice(0, 12) || null,
      assetClass,
      currency,
    });
    if (price) await setManualPrice(l, db(), asset.id, l.today, price);
    return {
      asset: {
        id: asset.id,
        name: asset.name,
        symbol: asset.symbol,
        isin: asset.isin,
        exchange: null,
        assetClass: asset.assetClass,
        currency: asset.currency,
        own: true,
      },
    };
  } catch (e) {
    return (await errorState(e)) ?? {};
  }
}

export async function setManualPriceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const l = await ledger();
  const f = fields(fd);
  const ta = await getT("assets");
  try {
    const date = parseDateField(f.date, l.today);
    const price = f.price?.trim() ? parseUserNumber(f.price) : null;
    if (price === null || D(price).lte(0)) return { error: ta("err_price"), field: "price" };
    await setManualPrice(l, db(), f.assetId ?? "", date, price);
  } catch (e) {
    return errorState(e);
  }
  refresh();
  return { message: ta("priceSaved") };
}

export async function setBondRatesAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const l = await ledger();
  const f = fields(fd);
  const ta = await getT("assets");
  const lines = (f.rates ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const rates = lines.map((s) => parseUserNumber(s.replace("%", "")));
  if (lines.length === 0 || rates.some((r) => r === null || D(r).lt(0) || D(r).gt(100)))
    return { error: ta("err_rates"), field: "rates" };
  try {
    await setBondRates(
      l,
      f.assetId ?? "",
      rates.map((r) => D(r!).div(100).toFixed()),
    );
  } catch (e) {
    return errorState(e);
  }
  refresh();
  return { message: ta("ratesSaved") };
}
