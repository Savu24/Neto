"use client";

import { useActionState, useId, useState, type ReactNode, type SelectHTMLAttributes } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import type { AccountType } from "@/generated/prisma/enums";
import { useT } from "@/i18n/client";
import { ACCOUNT_GROUPS, ACCOUNT_TYPE_LIST, ACCOUNT_TYPES, valuationOf } from "@/lib/portfolio/ledger/types";
import type { ActionState } from "./actions";

/** Formularz konta (HU-2.1, 2.5–2.7): wybór typu, potem pola zależne od typu. Tworzenie i edycja. */

export interface AccountFormValues {
  name?: string;
  type?: AccountType;
  currency?: string;
  institution?: string | null;
  taxWrapper?: string;
  ownershipSharePct?: string;
  includeInNetWorth?: boolean;
  notes?: string | null;
  principal?: string;
  ratePct?: string;
  startDate?: string;
  termMonths?: number;
  capitalization?: string;
  autoRenew?: boolean;
  payoutAccountId?: string | null;
  interestRatePct?: string | null;
  monthlyPayment?: string | null;
  endDate?: string | null;
  originalAmount?: string | null;
}

export function Select({
  label,
  children,
  hint,
  ...props
}: { label: string; hint?: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="h-11 rounded-[10px] border border-line bg-surface px-3 text-[15px] text-ink"
        {...props}
      >
        {children}
      </select>
      {hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="inline-flex items-center gap-2 text-[15px]">
      <input type="checkbox" className="size-4 accent-[var(--brand)]" {...props} />
      {label}
    </label>
  );
}

const CURRENCIES = ["PLN", "EUR", "USD", "GBP", "CHF"];

export function AccountForm({
  action,
  mode,
  values = {},
  payoutOptions,
  today,
}: {
  action: (state: ActionState, fd: FormData) => Promise<ActionState>;
  mode: "create" | "edit";
  values?: AccountFormValues;
  payoutOptions: readonly { id: string; name: string }[];
  today: string;
}) {
  const t = useT("assets");
  const [state, formAction] = useActionState(action, undefined);
  const [type, setType] = useState<AccountType | undefined>(values.type);
  const valuation = type ? valuationOf(type) : null;
  const err = (field: string) => (state?.field === field ? true : undefined);
  // Po błędzie React resetuje formularz do wartości domyślnych: podstawiamy to, co użytkownik wysłał.
  const v = (name: string, fallback?: string | number | null) => state?.values?.[name] ?? fallback ?? "";

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      {mode === "create" ? (
        <fieldset className="grid gap-3">
          <legend className="mb-2 text-base font-semibold">{t("chooseType")}</legend>
          {ACCOUNT_GROUPS.map((g) => (
            <div key={g}>
              <p className="mb-1.5 text-[13px] text-ink-3">{t(`group_${g}`)}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ACCOUNT_TYPE_LIST.filter((x) => ACCOUNT_TYPES[x].group === g).map((x) => (
                  <label
                    key={x}
                    className="flex cursor-pointer items-center gap-2 rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[14px] has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:font-semibold"
                  >
                    <input
                      type="radio"
                      name="type"
                      value={x}
                      checked={type === x}
                      onChange={() => setType(x)}
                      className="accent-[var(--brand)]"
                    />
                    {t(`type_${x}`)}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </fieldset>
      ) : (
        <input type="hidden" name="type" value={type} />
      )}

      {type ? (
        <div className="grid gap-4 rounded-xl border border-line bg-surface p-4">
          <Field
            label={t("name")}
            name="name"
            defaultValue={v("name", values.name)}
            maxLength={80}
            required
            aria-invalid={err("name")}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {mode === "create" ? (
              <Select
                label={t("currency")}
                name="currency"
                defaultValue={v("currency", values.currency ?? "PLN")}
              >
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            ) : null}
            <Field
              label={t("institution")}
              name="institution"
              defaultValue={v("institution", values.institution)}
              maxLength={80}
            />
          </div>

          {valuation === "investment" || valuation === "cash" || valuation === "deposit" ? (
            <Select
              label={t("taxWrapper")}
              name="taxWrapper"
              defaultValue={v("taxWrapper", values.taxWrapper ?? "NONE")}
            >
              {["NONE", "IKE", "IKZE", "PPK", "OIPE"].map((w) => (
                <option key={w} value={w}>
                  {t(`wrapper_${w as "NONE"}`)}
                </option>
              ))}
            </Select>
          ) : null}

          {mode === "create" && valuation === "cash" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t("openingBalance")}
                name="openingAmount"
                inputMode="decimal"
                defaultValue={v("openingAmount")}
                hint={t("openingBalanceHint")}
                aria-invalid={err("openingAmount")}
              />
              <Field
                label={t("openingDate")}
                name="openingDate"
                type="date"
                defaultValue={v("openingDate", today)}
                max={today}
              />
            </div>
          ) : null}
          {mode === "create" && valuation === "manual" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t("openingValue")}
                name="openingAmount"
                inputMode="decimal"
                defaultValue={v("openingAmount")}
                required
                aria-invalid={err("openingAmount")}
              />
              <Field
                label={t("valuationDate")}
                name="openingDate"
                type="date"
                defaultValue={v("openingDate", today)}
                max={today}
              />
            </div>
          ) : null}
          {mode === "create" && valuation === "liability" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t("liabilityBalance")}
                name="openingAmount"
                inputMode="decimal"
                defaultValue={v("openingAmount")}
                required
                aria-invalid={err("openingAmount")}
              />
              <Field
                label={t("openingDate")}
                name="openingDate"
                type="date"
                defaultValue={v("openingDate", today)}
                max={today}
              />
            </div>
          ) : null}

          {valuation === "deposit" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t("principal")}
                name="principal"
                inputMode="decimal"
                defaultValue={v("principal", values.principal)}
                required
                aria-invalid={err("principal")}
              />
              <Field
                label={t("rate")}
                name="rate"
                inputMode="decimal"
                defaultValue={v("rate", values.ratePct)}
                required
                aria-invalid={err("rate")}
              />
              <Field
                label={t("startDate")}
                name="startDate"
                type="date"
                defaultValue={v("startDate", values.startDate ?? today)}
                max={today}
                required
              />
              <Field
                label={t("termMonths")}
                name="termMonths"
                type="number"
                min={1}
                max={600}
                defaultValue={v("termMonths", values.termMonths ?? 12)}
                required
                aria-invalid={err("termMonths")}
              />
              <Select
                label={t("capitalization")}
                name="capitalization"
                defaultValue={v("capitalization", values.capitalization ?? "END")}
              >
                {(["END", "MONTHLY", "QUARTERLY", "ANNUAL"] as const).map((c) => (
                  <option key={c} value={c}>
                    {t(`cap_${c}`)}
                  </option>
                ))}
              </Select>
              <Select
                label={t("payoutAccount")}
                name="payoutAccountId"
                defaultValue={v("payoutAccountId", values.payoutAccountId)}
              >
                <option value="">{t("none")}</option>
                {payoutOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
              <Checkbox
                label={t("autoRenew")}
                name="autoRenew"
                defaultChecked={state?.values ? state.values.autoRenew === "on" : values.autoRenew}
              />
            </div>
          ) : null}

          {valuation === "liability" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t("interestRate")}
                name="interestRate"
                inputMode="decimal"
                defaultValue={v("interestRate", values.interestRatePct)}
                aria-invalid={err("interestRate")}
              />
              <Field
                label={t("monthlyPayment")}
                name="monthlyPayment"
                inputMode="decimal"
                defaultValue={v("monthlyPayment", values.monthlyPayment)}
              />
              <Field
                label={t("endDate")}
                name="endDate"
                type="date"
                defaultValue={v("endDate", values.endDate)}
              />
              <Field
                label={t("originalAmount")}
                name="originalAmount"
                inputMode="decimal"
                defaultValue={v("originalAmount", values.originalAmount)}
              />
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("ownershipShare")}
              name="ownershipShare"
              inputMode="decimal"
              defaultValue={v("ownershipShare", values.ownershipSharePct ?? "100")}
              hint={t("ownershipShareHint")}
              aria-invalid={err("ownershipShare")}
            />
            <div className="self-center">
              <input type="hidden" name="includeInNetWorthShown" value="1" />
              <Checkbox
                label={t("includeInNetWorth")}
                name="includeInNetWorth"
                defaultChecked={
                  state?.values ? state.values.includeInNetWorth === "on" : (values.includeInNetWorth ?? true)
                }
              />
            </div>
          </div>
          <TextArea
            label={t("notes")}
            hint={t("notesHint")}
            name="notes"
            defaultValue={v("notes", values.notes)}
          />
          <FormMessage state={state} />
          <SubmitButton className="justify-self-start">
            {mode === "create" ? t("createAccount") : t("saveAccount")}
          </SubmitButton>
        </div>
      ) : null}
    </form>
  );
}

function TextArea({
  label,
  hint,
  ...props
}: { label: string; hint: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        rows={3}
        maxLength={2000}
        aria-describedby={`${id}-hint`}
        className="rounded-[10px] border border-line bg-surface px-3 py-2 text-[15px] text-ink"
        {...props}
      />
      <p id={`${id}-hint`} className="text-[13px] text-ink-3">
        {hint}
      </p>
    </div>
  );
}
