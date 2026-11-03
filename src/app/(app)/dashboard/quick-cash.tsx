"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { useT } from "@/i18n/client";
import { recordTransactionAction, type ActionState } from "../assets/actions";

type Mode = "DEPOSIT" | "WITHDRAWAL";

export interface QuickAccount {
  id: string;
  name: string;
  currency: string;
}

/**
 * Szybka wpłata i wypłata z pulpitu: dwa przyciski, po kliknięciu krótki formularz (konto, kwota, data).
 * Zapis tą samą akcją co ekran „Dodaj transakcję”; po zapisie zostajemy na pulpicie.
 */
export function QuickCash({ accounts, today }: { accounts: readonly QuickAccount[]; today: string }) {
  const t = useT("dashboard");
  const [mode, setMode] = useState<Mode | null>(null);
  const [saved, setSaved] = useState<Mode | null>(null);

  const open = (m: Mode) => {
    setSaved(null);
    setMode((prev) => (prev === m ? null : m));
  };
  const button = (m: Mode) =>
    `inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] px-4 font-semibold shadow-card transition-colors sm:flex-none ${
      m === "DEPOSIT"
        ? mode === m
          ? "bg-brand-strong text-on-brand"
          : "bg-brand text-on-brand hover:bg-brand-strong"
        : mode === m
          ? "border border-brand bg-brand-soft text-brand"
          : "border border-line-strong bg-surface text-ink hover:bg-surface-2"
    }`;

  return (
    <div className="mt-5 border-t border-line pt-4" role="group" aria-label={t("quickLabel")}>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => open("DEPOSIT")}
          aria-expanded={mode === "DEPOSIT"}
          className={button("DEPOSIT")}
        >
          <span aria-hidden className="text-lg leading-none">
            +
          </span>
          {t("quickDeposit")}
        </button>
        <button
          type="button"
          onClick={() => open("WITHDRAWAL")}
          aria-expanded={mode === "WITHDRAWAL"}
          className={button("WITHDRAWAL")}
        >
          <span aria-hidden className="text-lg leading-none">
            −
          </span>
          {t("quickWithdrawal")}
        </button>
      </div>
      {mode ? (
        <QuickForm
          key={mode}
          mode={mode}
          accounts={accounts}
          today={today}
          onCancel={() => setMode(null)}
          onSaved={() => {
            setSaved(mode);
            setMode(null);
          }}
        />
      ) : null}
      {saved && !mode ? (
        <p role="status" className="mt-3 rounded-[10px] bg-up-soft px-3 py-2 text-sm text-up">
          {saved === "DEPOSIT" ? t("quickSavedDeposit") : t("quickSavedWithdrawal")}
        </p>
      ) : null}
    </div>
  );
}

const LAST_ACCOUNT = "neto-quick-account";

function QuickForm({
  mode,
  accounts,
  today,
  onCancel,
  onSaved,
}: {
  mode: Mode;
  accounts: readonly QuickAccount[];
  today: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const t = useT("dashboard");
  const selectId = useId();
  const [state, action] = useActionState<ActionState, FormData>(recordTransactionAction, undefined);
  const [accountId, setAccountId] = useState(() => {
    try {
      const last = localStorage.getItem(LAST_ACCOUNT);
      if (last && accounts.some((a) => a.id === last)) return last;
    } catch {
      // Bez pamięci przeglądarki domyślnie pierwsze konto.
    }
    return accounts[0]?.id ?? "";
  });

  useEffect(() => {
    if (state?.message) onSaved();
  }, [state, onSaved]);

  return (
    <form
      action={(fd) => {
        try {
          localStorage.setItem(LAST_ACCOUNT, accountId);
        } catch {
          // jw.
        }
        action(fd);
      }}
      className="mt-4 grid gap-3 sm:grid-cols-[1.3fr_1fr_1fr] sm:items-end"
    >
      <input type="hidden" name="type" value={mode} />
      <input type="hidden" name="returnTo" value="dashboard" />
      <div className="grid gap-1">
        <label htmlFor={selectId} className="text-sm font-medium">
          {t("quickAccount")}
        </label>
        <select
          id={selectId}
          name="accountId"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="h-11 rounded-[10px] border border-line-strong bg-surface px-3 text-[15px] text-ink"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.currency === "PLN" ? a.name : `${a.name} (${a.currency})`}
            </option>
          ))}
        </select>
      </div>
      <Field
        label={t("quickAmount")}
        name="amount"
        inputMode="decimal"
        placeholder="500"
        defaultValue={state?.values?.amount}
        autoFocus
        required
      />
      <Field
        label={t("quickDate")}
        name="date"
        type="date"
        defaultValue={state?.values?.date ?? today}
        max={today}
        required
      />
      <div className="sm:col-span-3">
        <FormMessage state={state?.error ? state : undefined} />
      </div>
      <div className="flex gap-2 sm:col-span-3">
        <SubmitButton>{mode === "DEPOSIT" ? t("saveDeposit") : t("saveWithdrawal")}</SubmitButton>
        <button
          type="button"
          onClick={onCancel}
          className="h-11 rounded-[10px] px-4 font-semibold text-ink-2 transition-colors hover:bg-surface-2"
        >
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
