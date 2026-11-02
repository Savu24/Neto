"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

/** Stan zwracany przez akcje formularzy: komunikat już przetłumaczony po stronie serwera. */
export type FormState = { error?: string; message?: string } | undefined;

export function Field({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={hintId}
        className="h-11 rounded-[10px] border border-line bg-surface px-3 text-[15px] text-ink placeholder:text-ink-3 focus-visible:border-brand"
        {...props}
      />
      {hint ? (
        <p id={hintId} className="text-[13px] text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  className = "",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
}) {
  const { pending } = useFormStatus();
  const styles = {
    primary: "bg-brand text-on-brand",
    secondary: "border border-line text-brand",
    danger: "border border-down text-down",
  }[variant];
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`h-11 rounded-[10px] px-4 font-semibold disabled:opacity-60 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (state?.error) {
    return (
      <p role="alert" className="rounded-[10px] bg-down-soft px-3 py-2 text-sm text-ink">
        {state.error}
      </p>
    );
  }
  if (state?.message) {
    return (
      <p role="status" className="rounded-[10px] bg-brand-soft px-3 py-2 text-sm text-ink">
        {state.message}
      </p>
    );
  }
  return null;
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-[10px] bg-brand-soft px-3 py-2 text-sm text-ink">
      {children}
    </p>
  );
}
