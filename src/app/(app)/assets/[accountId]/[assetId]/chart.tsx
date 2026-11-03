import type { Locale } from "@/i18n/config";
import { formatDate, formatMoney } from "@/lib/format";
import type { HistoryPoint } from "@/lib/portfolio/ledger/history";

const W = 600;
const H = 200;
const PAD = 8;

/**
 * Wykres „Wartość i koszt” (makieta pozycja.html): linia wartości i przerywana linia kosztu nabycia.
 * SVG skaluje się do szerokości kontenera; dane są też w tabeli dla czytników ekranu (SPEC 13, WCAG).
 * Liczby zamieniamy na number dopiero tutaj, do rysowania (SPEC 7.1).
 */
export function ValueChart({
  points,
  labels,
  locale,
}: {
  points: readonly HistoryPoint[];
  labels: { value: string; cost: string; alt: string; empty: string; month: string };
  locale: Locale;
}) {
  const usable = points.filter((p) => p.valuePln !== null || p.costPln !== null);
  if (usable.length < 2) return <p className="text-ink-2">{labels.empty}</p>;

  const values = usable.flatMap((p) =>
    [p.valuePln, p.costPln].filter((v): v is string => v !== null).map(Number),
  );
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || Math.max(1, max * 0.1);
  const lo = min - span * 0.1;
  const hi = max + span * 0.1;
  const x = (i: number) => PAD + (i / (usable.length - 1)) * (W - 2 * PAD);
  const y = (v: number) => PAD + (1 - (v - lo) / (hi - lo)) * (H - 2 * PAD);
  const line = (key: "valuePln" | "costPln") =>
    usable
      .map((p, i) => (p[key] === null ? null : `${x(i).toFixed(1)},${y(Number(p[key])).toFixed(1)}`))
      .filter(Boolean)
      .join(" ");
  const month = (d: string) =>
    new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-GB", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    }).format(new Date(`${d}T00:00:00Z`));

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-48 w-full"
        role="img"
        aria-label={labels.alt}
      >
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={0}
            x2={W}
            y1={PAD + f * (H - 2 * PAD)}
            y2={PAD + f * (H - 2 * PAD)}
            stroke="var(--line)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <polyline
          points={line("costPln")}
          fill="none"
          stroke="var(--ink-3)"
          strokeWidth={2}
          strokeDasharray="5 4"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={line("valuePln")}
          fill="none"
          stroke="var(--brand)"
          strokeWidth={2.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-1 flex justify-between text-[12px] text-ink-3" aria-hidden="true">
        <span>{month(usable[0].date)}</span>
        <span>{month(usable[usable.length - 1].date)}</span>
      </div>
      <figcaption className="mt-2 flex gap-4 text-[13px] text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-[3px] w-4 bg-brand" aria-hidden="true" />
          {labels.value}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-0 w-4 border-t-2 border-dashed border-ink-3" aria-hidden="true" />
          {labels.cost}
        </span>
      </figcaption>
      <div className="sr-only">
        <table>
          <caption>{labels.alt}</caption>
          <thead>
            <tr>
              <th scope="col">{labels.month}</th>
              <th scope="col">{labels.value}</th>
              <th scope="col">{labels.cost}</th>
            </tr>
          </thead>
          <tbody>
            {usable.map((p) => (
              <tr key={p.date}>
                <th scope="row">{formatDate(`${p.date}T12:00:00Z`, locale)}</th>
                <td>{p.valuePln ? formatMoney(p.valuePln, "PLN", locale) : "—"}</td>
                <td>{p.costPln ? formatMoney(p.costPln, "PLN", locale) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
