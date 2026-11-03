"use client";

import { useActionState, useEffect, useId, useState, useTransition } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import type { AccountType, TransactionType } from "@/generated/prisma/enums";
import { useT } from "@/i18n/client";
import type { InstrumentHit } from "@/lib/portfolio/catalog/search";
import { allowedTransactions, valuationOf } from "@/lib/portfolio/ledger/types";
import { Select } from "../../assets/account-form";
import {
  createManualAssetAction,
  recordTransactionAction,
  searchInstrumentsAction,
  type ActionState,
} from "../../assets/actions";

/** Formularz transakcji (HU-2.3): pola zależne od rodzaju i typu konta; instrument z wyszukiwarki (HU-2.2). */

export interface FormAccount {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
}

export interface FormHolding {
  accountId: string;
  assetId: string;
  name: string;
  symbol: string | null;
  currency: string;
  quantity: string;
}

const CURRENCIES = ["PLN", "EUR", "USD", "GBP", "CHF"];

export function TransactionForm({
  accounts,
  transferTargets,
  holdings,
  initialAccountId,
  initialAsset,
  today,
}: {
  accounts: readonly FormAccount[];
  transferTargets: readonly FormAccount[];
  holdings: readonly FormHolding[];
  initialAccountId?: string;
  initialAsset?: InstrumentHit | null;
  today: string;
}) {
  const t = useT("transactions");
  const [state, action] = useActionState<ActionState, FormData>(recordTransactionAction, undefined);
  const [accountId, setAccountId] = useState(initialAccountId ?? accounts[0]?.id ?? "");
  const account = accounts.find((a) => a.id === accountId);
  const types: TransactionType[] = account
    ? allowedTransactions(account.type).filter((x) => x !== "TRANSFER_IN")
    : [];
  const [type, setType] = useState<TransactionType>(initialAsset ? "BUY" : (types[0] ?? "DEPOSIT"));
  const effectiveType = types.includes(type) ? type : (types[0] ?? type);
  const [asset, setAsset] = useState<InstrumentHit | null>(initialAsset ?? null);
  const [sellAssetId, setSellAssetId] = useState(initialAsset?.id ?? "");
  const [toAccountId, setToAccountId] = useState("");
  const v = (name: string, fallback = "") => state?.values?.[name] ?? fallback;

  const isBonds = account?.type === "RETAIL_BONDS";
  const accountHoldings = holdings.filter((h) => h.accountId === accountId);
  const sellHolding = accountHoldings.find((h) => h.assetId === sellAssetId);
  const tradeCurrency = effectiveType === "BUY" ? asset?.currency : sellHolding?.currency;
  const target = transferTargets.find((a) => a.id === toAccountId);
  const label = (x: TransactionType) =>
    x === "BALANCE_SET" && account && valuationOf(account.type) === "liability"
      ? t("balanceLiability")
      : t(`type_${x}`);

  if (accounts.length === 0) return <p className="text-ink-2">{t("noAccounts")}</p>;

  return (
    <form
      action={action}
      className="grid gap-4 rounded-xl border border-line bg-surface p-4 shadow-card lg:p-5"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label={t("account")}
          name="accountId"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <Select
          label={t("type")}
          name="type"
          value={effectiveType}
          onChange={(e) => setType(e.target.value as TransactionType)}
        >
          {types.map((x) => (
            <option key={x} value={x}>
              {label(x)}
            </option>
          ))}
        </Select>
      </div>

      {effectiveType === "BUY" && isBonds ? (
        <>
          <input type="hidden" name="mode" value="bond" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("series")}
              name="series"
              hint={t("seriesHint")}
              defaultValue={v("series")}
              autoCapitalize="characters"
              required
            />
            <Field
              label={t("bondCount")}
              name="quantity"
              inputMode="numeric"
              defaultValue={v("quantity")}
              required
            />
            <Field
              label={t("firstRate")}
              name="firstRate"
              inputMode="decimal"
              hint={t("firstRateHint")}
              defaultValue={v("firstRate")}
            />
            <Field
              label={t("bondPrice")}
              name="price"
              inputMode="decimal"
              hint={t("bondPriceHint")}
              defaultValue={v("price", "100")}
            />
          </div>
        </>
      ) : null}

      {effectiveType === "BUY" && !isBonds ? <InstrumentPicker selected={asset} onSelect={setAsset} /> : null}

      {effectiveType === "SELL" || effectiveType === "DIVIDEND" ? (
        <Select
          label={effectiveType === "DIVIDEND" ? t("dividendFor") : t("instrument")}
          name="assetId"
          value={sellAssetId}
          onChange={(e) => setSellAssetId(e.target.value)}
        >
          <option value="">{effectiveType === "DIVIDEND" ? "—" : t("searchPlaceholder")}</option>
          {accountHoldings.map((h) => (
            <option key={h.assetId} value={h.assetId}>
              {h.symbol ? `${h.symbol}: ` : ""}
              {h.name} ({h.quantity})
            </option>
          ))}
        </Select>
      ) : null}

      {(effectiveType === "BUY" && !isBonds) || effectiveType === "SELL" ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {effectiveType === "BUY" ? <input type="hidden" name="assetId" value={asset?.id ?? ""} /> : null}
          <Field
            label={t("quantity")}
            name="quantity"
            inputMode="decimal"
            defaultValue={v("quantity")}
            required
            aria-invalid={state?.field === "quantity" || undefined}
          />
          <Field
            label={tradeCurrency ? `${t("price")} (${tradeCurrency})` : t("price")}
            name="price"
            inputMode="decimal"
            defaultValue={v("price")}
            required
            aria-invalid={state?.field === "price" || undefined}
          />
          <Field label={t("fee")} name="fee" inputMode="decimal" defaultValue={v("fee")} />
          {tradeCurrency && tradeCurrency !== "PLN" ? (
            <div className="sm:col-span-3">
              <Field
                label={t("fxRate", { currency: tradeCurrency })}
                name="fxRate"
                inputMode="decimal"
                hint={t("fxRateHint", { currency: tradeCurrency })}
                defaultValue={v("fxRate")}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {["DEPOSIT", "WITHDRAWAL", "DIVIDEND", "INTEREST", "FEE", "TAX"].includes(effectiveType) ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("amount")}
            name="amount"
            inputMode="decimal"
            defaultValue={v("amount")}
            required
            aria-invalid={state?.field === "amount" || undefined}
          />
          <Select
            label={t("currency")}
            name="currency"
            defaultValue={v("currency", account?.currency)}
            key={accountId}
          >
            {[...new Set([account?.currency ?? "PLN", ...CURRENCIES])].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </div>
      ) : null}

      {effectiveType === "TRANSFER_OUT" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={t("toAccount")}
            name="toAccountId"
            value={toAccountId}
            onChange={(e) => setToAccountId(e.target.value)}
          >
            <option value="">{t("selectAccount")}</option>
            {transferTargets
              .filter((a) => a.id !== accountId)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
          </Select>
          <Field label={t("amount")} name="amount" inputMode="decimal" defaultValue={v("amount")} required />
          {target && account && target.currency !== account.currency ? (
            <Field
              label={`${t("toAmount")} (${target.currency})`}
              name="toAmount"
              inputMode="decimal"
              hint={t("toAmountHint")}
              defaultValue={v("toAmount")}
              required
            />
          ) : null}
        </div>
      ) : null}

      {effectiveType === "VALUATION" || effectiveType === "BALANCE_SET" ? (
        <Field
          label={
            effectiveType === "VALUATION"
              ? t("newValue")
              : account && valuationOf(account.type) === "liability"
                ? t("balanceLiability")
                : t("newBalance")
          }
          name="amount"
          inputMode="decimal"
          defaultValue={v("amount")}
          required
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={effectiveType === "BUY" && isBonds ? t("purchaseDate") : t("date")}
          name="date"
          type="date"
          defaultValue={v("date", today)}
          max={today}
          required
          aria-invalid={state?.field === "date" || undefined}
        />
        <Field label={t("note")} name="note" defaultValue={v("note")} maxLength={500} />
      </div>

      <FormMessage state={state} />
      <SubmitButton className="justify-self-start">{t("save")}</SubmitButton>
    </form>
  );
}

/** Wyszukiwarka instrumentów z katalogu i własnych, z dodaniem instrumentu ręcznego. */
function InstrumentPicker({
  selected,
  onSelect,
}: {
  selected: InstrumentHit | null;
  onSelect: (asset: InstrumentHit | null) => void;
}) {
  const t = useT("transactions");
  const ta = useT("assets");
  const id = useId();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<InstrumentHit[] | null>(null);
  const [manual, setManual] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const timer = setTimeout(() => {
      startTransition(async () => setHits(await searchInstrumentsAction(q)));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  if (selected) {
    return (
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] bg-brand-soft px-3 py-2.5"
        role="status"
      >
        <span>
          {t("chosen", { name: `${selected.name}${selected.symbol ? ` (${selected.symbol})` : ""}` })}
          <span className="ml-1.5 text-[13px] text-ink-2">
            {[selected.exchange, selected.currency, selected.own ? t("own") : null]
              .filter(Boolean)
              .join(", ")}
          </span>
        </span>
        <button type="button" onClick={() => onSelect(null)} className="text-[14px] font-semibold text-brand">
          {t("change")}
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {t("searchLabel")}
      </label>
      <input
        id={id}
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!e.target.value.trim()) setHits(null);
        }}
        placeholder={t("searchPlaceholder")}
        autoComplete="off"
        className="h-11 rounded-[10px] border border-line-strong bg-surface px-3 text-[15px] text-ink placeholder:text-ink-3"
      />
      <div aria-live="polite" className="text-[13px] text-ink-3">
        {pending ? t("searching") : hits && hits.length === 0 && query.trim() ? t("searchEmpty") : null}
      </div>
      {hits && hits.length > 0 && query.trim() ? (
        <ul className="divide-y divide-line rounded-[10px] border border-line" aria-label={t("instrument")}>
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => onSelect(h)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-bg"
              >
                <span>
                  <span className="font-medium">{h.name}</span>
                  <span className="block text-[13px] text-ink-3">
                    {[h.symbol, h.isin, h.exchange, ta(`class_${h.assetClass as "ETF"}`)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="text-[13px] text-ink-2">{h.currency}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {manual ? (
        <ManualInstrument onCreated={onSelect} onCancel={() => setManual(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setManual(true)}
          className="justify-self-start text-[14px] font-semibold text-brand"
        >
          {t("addManual")}
        </button>
      )}
    </div>
  );
}

/** Instrument ręczny (HU-2.2): pola poza właściwym formularzem, zapis osobną akcją. */
function ManualInstrument({
  onCreated,
  onCancel,
}: {
  onCreated: (a: InstrumentHit) => void;
  onCancel: () => void;
}) {
  const t = useT("transactions");
  const ta = useT("assets");
  const tc = useT("common");
  const [values, setValues] = useState({
    name: "",
    symbol: "",
    isin: "",
    assetClass: "ETF",
    currency: "PLN",
    price: "",
  });
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const set = (k: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues({ ...values, [k]: e.target.value });

  function create() {
    startTransition(async () => {
      const fd = new FormData();
      for (const [k, val] of Object.entries(values)) fd.set(k, val);
      const res = await createManualAssetAction(undefined, fd);
      if (res?.asset) onCreated(res.asset);
      else setError(res?.error);
    });
  }

  return (
    <fieldset className="grid gap-3 rounded-[10px] border border-line p-3">
      <legend className="px-1 text-sm font-semibold">{t("manualTitle")}</legend>
      <Field label={t("manualName")} value={values.name} onChange={set("name")} maxLength={120} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("manualSymbol")} value={values.symbol} onChange={set("symbol")} maxLength={20} />
        <Field label={t("manualIsin")} value={values.isin} onChange={set("isin")} maxLength={12} />
        <Select label={t("manualClass")} value={values.assetClass} onChange={set("assetClass")}>
          {["EQUITY", "ETF", "FUND", "BOND", "CRYPTO", "COMMODITY", "OTHER"].map((c) => (
            <option key={c} value={c}>
              {ta(`class_${c as "ETF"}`)}
            </option>
          ))}
        </Select>
        <Select label={t("manualCurrency")} value={values.currency} onChange={set("currency")}>
          {CURRENCIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Field label={t("manualPrice")} value={values.price} onChange={set("price")} inputMode="decimal" />
      </div>
      {error ? (
        <p role="alert" className="rounded-[10px] bg-down-soft px-3 py-2 text-sm">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={create}
          disabled={pending}
          className="h-11 rounded-[10px] border border-line px-4 font-semibold text-brand disabled:opacity-60"
        >
          {t("manualCreate")}
        </button>
        <button type="button" onClick={onCancel} className="h-11 px-3 text-ink-2">
          {tc("cancel")}
        </button>
      </div>
    </fieldset>
  );
}
