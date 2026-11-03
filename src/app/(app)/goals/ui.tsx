import type { Locale } from "@/i18n/config";
import { formatMoney } from "@/lib/format";

/** Elementy wspólne karty celu (serwer) i podglądu w formularzu (klient): bez hooków. */

export function SavingsFigures({
  perDay,
  perWeek,
  perMonth,
  labels,
  locale,
}: {
  perDay: string;
  perWeek: string;
  perMonth: string | null;
  labels: { title: string; perDay: string; perWeek: string; perMonth: string };
  locale: Locale;
}) {
  const items = [
    { label: labels.perDay, value: perDay, testId: "per-day" },
    { label: labels.perWeek, value: perWeek, testId: "per-week" },
    ...(perMonth === null ? [] : [{ label: labels.perMonth, value: perMonth, testId: "per-month" }]),
  ];
  return (
    <div>
      <p className="text-[13px] font-medium text-ink-2">{labels.title}</p>
      <dl className="mt-2 grid grid-cols-3 gap-2">
        {items.map((i) => (
          <div key={i.testId} className="flex flex-col-reverse rounded-[10px] bg-brand-soft px-3 py-2.5">
            <dt className="text-[12.5px] text-ink-2">{i.label}</dt>
            <dd className="text-[17px] font-semibold text-ink lg:text-lg" data-testid={i.testId} data-amt="">
              {formatMoney(i.value, "PLN", locale)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function ProgressBar({ fraction, label }: { fraction: string | null; label: string }) {
  const pct = fraction === null ? 0 : Math.round(Number(fraction) * 1000) / 10;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-2.5 overflow-hidden rounded-full bg-line"
    >
      <div className="h-full rounded-full bg-up" style={{ width: `${pct}%` }} />
    </div>
  );
}
