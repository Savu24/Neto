import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, meta, actions }: { title: string; meta?: string; actions?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-4 pt-5 pb-3 lg:pt-8 lg:pb-5">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink lg:text-[28px]">{title}</h1>
        {meta ? <p className="mt-0.5 text-[13.5px] text-ink-3">{meta}</p> : null}
      </div>
      {actions ? <div className="flex gap-1">{actions}</div> : null}
    </header>
  );
}

/** Pusty stan to zaproszenie do działania: tytuł, jedno zdanie i jedna akcja. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <section className="mt-4 rounded-2xl border border-line bg-surface px-6 py-9 shadow-card">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-1.5 max-w-[60ch] text-ink-2">{body}</p>
      {action ? (
        <Link
          href={action.href}
          className="mt-5 inline-flex rounded-[10px] bg-brand px-4 py-2.5 font-semibold text-on-brand shadow-card transition-colors hover:bg-brand-strong"
        >
          {action.label}
        </Link>
      ) : null}
    </section>
  );
}

/** Stały dopisek na ekranach z wynikami (SPEC sekcja 6). Nie usuwać i nie ukrywać. */
export function Disclaimer({ children }: { children: ReactNode }) {
  return (
    <p className="mt-7 max-w-[70ch] border-t border-line pt-3.5 text-[12.5px] text-ink-3" role="note">
      {children}
    </p>
  );
}
