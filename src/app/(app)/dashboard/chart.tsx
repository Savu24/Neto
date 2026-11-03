import type { Locale } from "@/i18n/config";
import { formatDate, formatMoney } from "@/lib/format";
import type { SeriesPoint } from "@/lib/portfolio/ledger/net-worth-series";

const W = 640;
const H = 240;
const PAD = 6;

/**
 * Wykres bilansu (SPEC 20, „linia bilansu”): aktywa nad linią zera, zobowiązania pod nią, wartość netto
 * jako linia. SVG rozciąga się do szerokości kontenera; etykiety osi są w HTML, żeby się nie deformowały.
 * Dane są też w tabeli dla czytników ekranu. Liczby zamieniamy na number dopiero do rysowania.
 */
export function NetWorthChart({
  points,
  labels,
  locale,
}: {
  points: readonly SeriesPoint[];
  labels: { alt: string; empty: string; assets: string; liabilities: string; netWorth: string; date: string };
  locale: Locale;
}) {
  if (points.length < 2) return <p className="py-10 text-center text-ink-2">{labels.empty}</p>;

  const a = points.map((p) => Number(p.assets));
  const l = points.map((p) => -Number(p.liabilities));
  const n = points.map((p) => Number(p.netWorth));
  const hi = Math.max(...a, ...n, 0);
  const lo = Math.min(...l, ...n, 0);
  const span = hi - lo || 1;
  const top = hi + span * 0.06;
  const bottom = lo - (lo < 0 ? span * 0.06 : 0);
  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - 2 * PAD);
  const y = (v: number) => PAD + (1 - (v - bottom) / (top - bottom)) * (H - 2 * PAD);
  const pts = (vals: number[]) => vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = (vals: number[]) =>
    `${x(0).toFixed(1)},${y(0).toFixed(1)} ${pts(vals)} ${x(vals.length - 1).toFixed(1)},${y(0).toFixed(1)}`;
  const hasLiabilities = l.some((v) => v < 0);

  const compact = (v: number) =>
    new Intl.NumberFormat(locale === "pl" ? "pl-PL" : "en-GB", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(v);
  const ticks = [...new Set([hi, 0, ...(hasLiabilities ? [lo] : [])])];
  const shortDate = (d: string) =>
    new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-GB", {
      day: points.length <= 40 ? "numeric" : undefined,
      month: "short",
      year: points.length <= 40 ? undefined : "2-digit",
      timeZone: "UTC",
    }).format(new Date(`${d}T00:00:00Z`));
  const xTicks = [0, Math.floor((points.length - 1) / 2), points.length - 1];

  return (
    <figure>
      <div className="relative pr-14">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-56 w-full lg:h-64"
          role="img"
          aria-label={labels.alt}
        >
          <defs>
            <pattern
              id="hatch"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="6" height="6" fill="var(--down-soft)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--down)" strokeOpacity="0.35" strokeWidth="2" />
            </pattern>
            <linearGradient id="assetsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.04" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <line
              key={t}
              x1={0}
              x2={W}
              y1={y(t)}
              y2={y(t)}
              stroke={t === 0 ? "var(--ink-3)" : "var(--line)"}
              strokeOpacity={t === 0 ? 0.5 : 1}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <polygon points={area(a)} fill="url(#assetsFill)" />
          {hasLiabilities ? <polygon points={area(l)} fill="url(#hatch)" /> : null}
          <polyline
            points={pts(n)}
            fill="none"
            stroke="var(--brand)"
            strokeWidth={2.5}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-13 text-[11.5px] text-ink-3"
          aria-hidden
        >
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: `${(y(t) / H) * 100}%` }}
            >
              {compact(t)}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex justify-between pr-14 text-[12px] text-ink-3" aria-hidden>
        {xTicks.map((i) => (
          <span key={i}>{shortDate(points[i].date)}</span>
        ))}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block size-3 rounded-[3px] bg-brand/15" aria-hidden />
          {labels.assets}
        </span>
        {hasLiabilities ? (
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block size-3 rounded-[3px] border border-down/40 bg-down-soft" aria-hidden />
            {labels.liabilities}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block h-[3px] w-4 rounded bg-brand" aria-hidden />
          {labels.netWorth}
        </span>
      </figcaption>
      <table className="sr-only">
        <caption>{labels.alt}</caption>
        <thead>
          <tr>
            <th scope="col">{labels.date}</th>
            <th scope="col">{labels.assets}</th>
            <th scope="col">{labels.liabilities}</th>
            <th scope="col">{labels.netWorth}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <th scope="row">{formatDate(`${p.date}T12:00:00Z`, locale)}</th>
              <td>{formatMoney(p.assets, "PLN", locale)}</td>
              <td>{formatMoney(p.liabilities, "PLN", locale)}</td>
              <td>{formatMoney(p.netWorth, "PLN", locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
