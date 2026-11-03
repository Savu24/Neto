"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { useLocale, useT } from "@/i18n/client";
import { D, sum } from "@/lib/money";
import type { GoalSource } from "@/lib/portfolio/goal-input";
import { savingsPlan } from "@/lib/portfolio/goals";
import { parseUserNumber } from "@/lib/portfolio/import/numbers";
import type { GoalActionState } from "./actions";
import { SavingsFigures } from "./ui";

/** Formularz celu (HU-5.1, 5.2): tworzenie i edycja, z podglądem kwot do odkładania na żywo. */

export interface GoalFormValues {
  name?: string;
  targetAmount?: string;
  targetDate?: string | null;
  source?: GoalSource;
  savedAmount?: string | null;
  accountIds?: readonly string[];
  isMain?: boolean;
}

export interface LinkableAccount {
  id: string;
  name: string;
  /** Wartość w PLN (do podglądu). */
  valuePln: string;
}

/** Ta sama data za `years` lat (29.02 → 28.02). */
function inYears(today: string, years: number): string {
  const [y, m, d] = today.split("-").map(Number);
  const last = new Date(Date.UTC(y + years, m, 0)).getUTCDate();
  return `${y + years}-${String(m).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

export function GoalForm({
  action,
  mode,
  values = {},
  accounts,
  netWorth,
  today,
}: {
  action: (state: GoalActionState, fd: FormData) => Promise<GoalActionState>;
  mode: "create" | "edit";
  values?: GoalFormValues;
  accounts: readonly LinkableAccount[];
  netWorth: string;
  today: string;
}) {
  const t = useT("goals");
  const locale = useLocale();
  const [state, formAction] = useActionState(action, undefined);
  const [name, setName] = useState(values.name ?? "");
  const [target, setTarget] = useState(values.targetAmount ?? "");
  const [date, setDate] = useState(values.targetDate ?? "");
  const [source, setSource] = useState<GoalSource>(values.source ?? "manual");
  const [saved, setSaved] = useState(values.savedAmount ?? "");
  const [selected, setSelected] = useState<readonly string[]>(values.accountIds ?? []);
  const [isMain, setIsMain] = useState(values.isMain ?? false);

  const targetNum = parseUserNumber(target);
  const current =
    source === "netWorth"
      ? D(netWorth)
      : source === "accounts"
        ? sum(accounts.filter((a) => selected.includes(a.id)).map((a) => a.valuePln))
        : D(parseUserNumber(saved) ?? 0);
  const plan =
    targetNum !== null && D(targetNum).gt(0) && date > today
      ? savingsPlan(current, targetNum, today, date)
      : null;

  const presets = [
    { years: 1, label: t("in1Year") },
    { years: 3, label: t("in3Years") },
    { years: 5, label: t("in5Years") },
  ];
  const sources: { value: GoalSource; label: string }[] = [
    { value: "manual", label: t("sourceOptManual") },
    { value: "accounts", label: t("sourceOptAccounts") },
    { value: "netWorth", label: t("sourceOptNetWorth") },
  ];

  return (
    <form action={formAction} className="grid max-w-xl gap-5" noValidate>
      <Field
        label={t("fieldName")}
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("fieldNamePlaceholder")}
        maxLength={80}
        required
        aria-invalid={state?.field === "name" || undefined}
      />
      <Field
        label={t("fieldTarget")}
        name="targetAmount"
        inputMode="decimal"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        placeholder="50 000"
        required
        aria-invalid={state?.field === "targetAmount" || undefined}
      />
      <div className="grid gap-2">
        <Field
          label={t("fieldDate")}
          name="targetDate"
          type="date"
          value={date}
          min={today}
          onChange={(e) => setDate(e.target.value)}
          hint={t("fieldDateHint")}
          aria-invalid={state?.field === "targetDate" || undefined}
        />
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => {
            const value = inYears(today, p.years);
            const active = date === value;
            return (
              <button
                key={p.years}
                type="button"
                onClick={() => setDate(value)}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1.5 text-[13px] font-medium ${
                  active ? "border-brand bg-brand text-on-brand" : "border-line bg-surface text-ink-2"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">{t("fieldSource")}</legend>
        {sources.map((s) => (
          <label
            key={s.value}
            className={`flex items-center gap-3 rounded-[10px] border px-3 py-2.5 text-[15px] ${
              source === s.value ? "border-brand bg-brand-soft" : "border-line bg-surface"
            }`}
          >
            <input
              type="radio"
              name="source"
              value={s.value}
              checked={source === s.value}
              onChange={() => setSource(s.value)}
              className="size-4 accent-[var(--brand)]"
            />
            {s.label}
          </label>
        ))}
      </fieldset>

      {source === "manual" ? (
        <Field
          label={t("fieldSaved")}
          name="savedAmount"
          inputMode="decimal"
          value={saved}
          onChange={(e) => setSaved(e.target.value)}
          placeholder="0"
          hint={t("fieldSavedHint")}
          aria-invalid={state?.field === "savedAmount" || undefined}
        />
      ) : null}

      {source === "accounts" ? (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">{t("fieldAccounts")}</legend>
          {accounts.length === 0 ? (
            <p className="text-[14px] text-ink-2">
              {t("noAccounts")}{" "}
              <Link href="/add/account" className="font-semibold text-brand">
                {t("addAccount")}
              </Link>
            </p>
          ) : (
            accounts.map((a) => (
              <label key={a.id} className="inline-flex items-center gap-2 text-[15px]">
                <input
                  type="checkbox"
                  name="accountIds"
                  value={a.id}
                  checked={selected.includes(a.id)}
                  onChange={(e) =>
                    setSelected((prev) =>
                      e.target.checked ? [...prev, a.id] : prev.filter((id) => id !== a.id),
                    )
                  }
                  className="size-4 accent-[var(--brand)]"
                />
                {a.name}
              </label>
            ))
          )}
        </fieldset>
      ) : null}

      <label className="inline-flex items-center gap-2 text-[15px]">
        <input
          type="checkbox"
          name="isMain"
          checked={isMain}
          onChange={(e) => setIsMain(e.target.checked)}
          className="size-4 accent-[var(--brand)]"
        />
        {t("fieldMain")}
      </label>

      {plan ? (
        <section
          aria-label={t("previewTitle")}
          className="rounded-xl border border-line bg-surface p-4 shadow-card"
        >
          {plan.kind === "plan" ? (
            <>
              <SavingsFigures
                perDay={plan.perDay.toFixed()}
                perWeek={plan.perWeek.toFixed()}
                perMonth={plan.perMonth?.toFixed() ?? null}
                labels={{
                  title: t("saveTitle"),
                  perDay: t("perDay"),
                  perWeek: t("perWeek"),
                  perMonth: t("perMonth"),
                }}
                locale={locale}
              />
              <p className="mt-2 text-[13px] text-ink-3">{t("noReturnNote")}</p>
            </>
          ) : plan.kind === "achieved" ? (
            <p className="text-[15px] font-medium text-up">{t("achieved")}</p>
          ) : null}
        </section>
      ) : null}

      <FormMessage state={state} />
      <SubmitButton className="justify-self-start">
        {mode === "create" ? t("create") : t("save")}
      </SubmitButton>
    </form>
  );
}

/** „Odłożone teraz” na karcie celu wpisywanego ręcznie. */
export function AddSavedForm({
  action,
}: {
  action: (state: GoalActionState, fd: FormData) => Promise<GoalActionState>;
}) {
  const t = useT("goals");
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
      <Field label={t("addSaved")} name="amount" inputMode="decimal" placeholder="500" required />
      <SubmitButton variant="secondary">{t("addSavedButton")}</SubmitButton>
      <div className="sm:col-span-2">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function DeleteGoalButton({ action, name }: { action: () => Promise<void>; name: string }) {
  const t = useT("goals");
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(t("deleteConfirm", { name }))) e.preventDefault();
      }}
    >
      <SubmitButton variant="danger">{t("delete")}</SubmitButton>
    </form>
  );
}
