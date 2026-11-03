import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import { formatMoney, formatPercent } from "@/lib/format";
import { D } from "@/lib/money";

/** Wspólne elementy ekranów Majątek, konta i pozycji (makiety majatek.html, pozycja.html). */

export function Money({
  value,
  currency = "PLN",
  locale,
  negative = false,
  signed = false,
  className = "",
}: {
  value: string;
  currency?: string;
  locale: Locale;
  /** Zobowiązania: wartość dodatnia pokazana ze znakiem minus. */
  negative?: boolean;
  signed?: boolean;
  className?: string;
}) {
  const v = negative ? D(value).neg().toFixed() : value;
  return (
    <span className={className || undefined} data-amt="">
      {formatMoney(v, currency, locale, { signed })}
    </span>
  );
}

/** Zmiana procentowa z kolorem i znakiem (kolor nigdy nie jest jedynym nośnikiem informacji). */
export function Change({ fraction, locale }: { fraction: string; locale: Locale }) {
  const d = D(fraction);
  const tone = d.isZero() ? "text-ink-3" : d.isPos() ? "text-up" : "text-down";
  return <span className={`text-[13px] ${tone}`}>{formatPercent(fraction, locale, { signed: true })}</span>;
}

export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warn" }) {
  return (
    <span
      className={`inline-flex rounded-md px-1.5 py-px text-[12px] font-medium ${
        tone === "warn" ? "bg-warn-soft text-warn" : "bg-brand-soft text-brand"
      }`}
    >
      {children}
    </span>
  );
}

export function Section({
  title,
  action,
  children,
  id,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="mt-4 rounded-xl border border-line bg-surface p-4 shadow-card lg:p-5"
      aria-label={title}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Rows({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul className="divide-y divide-line" aria-label={label}>
      {children}
    </ul>
  );
}

export function Row({
  name,
  sub,
  value,
  href,
  children,
  testId,
}: {
  name: ReactNode;
  sub?: ReactNode;
  value?: ReactNode;
  href?: string;
  children?: ReactNode;
  testId?: string;
}) {
  const label = href ? (
    <Link href={href} className="font-medium hover:text-brand hover:underline">
      {name}
    </Link>
  ) : (
    <span className="font-medium">{name}</span>
  );
  return (
    <li className="py-2.5" data-testid={testId}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="break-words">{label}</div>
          {sub ? <div className="text-[13px] text-ink-3">{sub}</div> : null}
        </div>
        {value ? <div className="shrink-0 text-right">{value}</div> : null}
      </div>
      {children}
    </li>
  );
}

export function KeyValues({ items }: { items: readonly [ReactNode, ReactNode, string?][] }) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[14px]">
      {items.map(([k, v, cls], i) => (
        <div key={i} className="contents">
          <dt className={`text-ink-2 ${cls ?? ""}`}>{k}</dt>
          <dd className="text-right">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="mt-3.5 inline-flex text-[13px] text-ink-2 hover:text-brand lg:mt-5">
      ← {children}
    </Link>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "secondary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-[10px] px-4 py-2.5 font-semibold transition-colors ${
        variant === "primary"
          ? "bg-brand text-on-brand shadow-card hover:bg-brand-strong"
          : "border border-line-strong bg-surface text-ink shadow-card hover:bg-surface-2"
      }`}
    >
      {children}
    </Link>
  );
}

export const dateOf = (key: string) => new Date(`${key}T12:00:00Z`);
