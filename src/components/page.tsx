import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, meta, actions }: { title: string; meta?: string; actions?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-4 pt-3.5 pb-2.5 lg:pt-5.5 lg:pb-4.5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">{title}</h1>
        {meta ? <p className="text-[13px] text-ink-3">{meta}</p> : null}
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
    <section className="mt-4 rounded-xl border border-line bg-surface px-5 py-8">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 max-w-[60ch] text-ink-2">{body}</p>
      {action ? (
        <Link
          href={action.href}
          className="mt-4 inline-flex rounded-[10px] bg-brand px-4 py-2.5 font-semibold text-on-brand"
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
