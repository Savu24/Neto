"use client";

import { useActionState, useId, type ReactNode } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { useT } from "@/i18n/client";
import {
  closeDepositAction,
  deleteTransactionAction,
  recordTransactionAction,
  setBondRatesAction,
  setManualPriceAction,
  type ActionState,
} from "./actions";

/** Małe formularze ekranów konta i pozycji (komponenty klienckie: stan akcji i komunikaty błędów). */

export function DeleteTransactionButton({ transactionId, label }: { transactionId: string; label: string }) {
  const t = useT("transactions");
  const [state, action, pending] = useActionState<ActionState, FormData>(deleteTransactionAction, undefined);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="transactionId" value={transactionId} />
      <button
        type="submit"
        disabled={pending}
        aria-label={`${t("delete")}: ${label}`}
        className="text-[13px] text-ink-3 hover:text-down disabled:opacity-60"
      >
        {t("delete")}
      </button>
      {state?.error ? (
        <p role="alert" className="mt-1 text-[13px] text-down">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

/** Szybka aktualizacja wyceny aktywa ręcznego albo salda zobowiązania/konta (HU-2.5, HU-2.7). */
export function QuickUpdateForm({
  accountId,
  type,
  label,
  submit,
  today,
}: {
  accountId: string;
  type: "VALUATION" | "BALANCE_SET";
  label: string;
  submit: string;
  today: string;
}) {
  const t = useT("transactions");
  const [state, action] = useActionState<ActionState, FormData>(recordTransactionAction, undefined);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="type" value={type} />
      <Field label={label} name="amount" inputMode="decimal" required />
      <Field label={t("date")} name="date" type="date" defaultValue={today} max={today} required />
      <SubmitButton>{submit}</SubmitButton>
      <div className="sm:col-span-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function CloseDepositForm({
  accountId,
  payoutAccountId,
  amount,
  date,
}: {
  accountId: string;
  payoutAccountId: string;
  amount: string;
  date: string;
}) {
  const t = useT("assets");
  const tt = useT("transactions");
  const [state, action] = useActionState<ActionState, FormData>(closeDepositAction, undefined);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="toAccountId" value={payoutAccountId} />
      <Field
        label={t("closeDepositAmount")}
        name="amount"
        inputMode="decimal"
        defaultValue={amount}
        required
      />
      <Field label={tt("date")} name="date" type="date" defaultValue={date} max={date} required />
      <SubmitButton variant="secondary">{t("closeDeposit")}</SubmitButton>
      <div className="sm:col-span-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function ManualPriceForm({
  assetId,
  currency,
  today,
}: {
  assetId: string;
  currency: string;
  today: string;
}) {
  const t = useT("assets");
  const [state, action] = useActionState<ActionState, FormData>(setManualPriceAction, undefined);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="assetId" value={assetId} />
      <Field label={t("priceLabel", { currency })} name="price" inputMode="decimal" required />
      <Field label={t("priceDate")} name="date" type="date" defaultValue={today} max={today} required />
      <FormMessage state={state} />
      <SubmitButton variant="secondary" className="justify-self-start">
        {t("savePrice")}
      </SubmitButton>
    </form>
  );
}

export function BondRatesForm({ assetId, rates }: { assetId: string; rates: string }) {
  const t = useT("assets");
  const id = useId();
  const [state, action] = useActionState<ActionState, FormData>(setBondRatesAction, undefined);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="assetId" value={assetId} />
      <label htmlFor={id} className="text-sm font-medium">
        {t("bondRates")}
      </label>
      <textarea
        id={id}
        name="rates"
        rows={4}
        defaultValue={rates}
        aria-describedby={`${id}-hint`}
        className="rounded-[10px] border border-line-strong bg-surface px-3 py-2 text-[15px] text-ink"
      />
      <p id={`${id}-hint`} className="text-[13px] text-ink-3">
        {t("bondRatesHint")}
      </p>
      <FormMessage state={state} />
      <SubmitButton variant="secondary" className="justify-self-start">
        {t("saveRates")}
      </SubmitButton>
    </form>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-[13px] text-ink-3">{children}</p>;
}
