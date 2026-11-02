"use client";

import { useEffect, useId, useRef, useState } from "react";
import { HORIZON_AGE, type RetirementResult, type ScenarioKey } from "@/lib/portfolio/retirement";

/** Kolory linii scenariuszy; te same w legendzie. */
export const scenarioStroke: Record<ScenarioKey, string> = {
  low: "var(--ink-3)",
  base: "var(--brand)",
  high: "var(--up)",
};

const PAD_L = 4;
const PAD_R = 64;
const TOP = 12;
const BOTTOM = 26;

/**
 * Trzy linie kapitału w czasie i pozioma linia potrzebnego kapitału (SPEC 7.11, makieta Cele).
 * Szerokość mierzona z kontenera, żeby napisy osi miały stały rozmiar na telefonie i desktopie.
 */
export function RetirementChart({
  result,
  retireAge,
  title,
  formatAxis,
}: {
  result: RetirementResult;
  retireAge: number;
  title: string;
  formatAxis: (value: number) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const clipId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(280, Math.round(entry.contentRect.width))),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const W = width;
  const H = W < 500 ? 220 : 240;
  const { scenarios } = result;
  const need = result.requiredCapital?.toNumber() ?? null;
  const series = {
    low: scenarios.low.series.map((p) => [p.age, p.capital.toNumber()] as const),
    base: scenarios.base.series.map((p) => [p.age, p.capital.toNumber()] as const),
    high: scenarios.high.series.map((p) => [p.age, p.capital.toNumber()] as const),
  };
  const firstAge = series.base[0][0];
  // Skala do kapitału w wieku 75 (jak w makiecie); wyższe wartości wychodzą poza wykres i są przycinane.
  const scaleAge = firstAge < 75 ? 75 : HORIZON_AGE;
  const atScaleAge = Object.values(series).map((s) => s.find(([age]) => age === scaleAge)?.[1] ?? 0);
  const maxV = Math.max(1, (need ?? 0) * 1.25, ...atScaleAge);
  const span = Math.max(1, HORIZON_AGE - firstAge);

  const x = (age: number) => PAD_L + ((age - firstAge) / span) * (W - PAD_L - PAD_R);
  const y = (v: number) => TOP + (1 - v / maxV) * (H - TOP - BOTTOM);
  const path = (s: readonly (readonly [number, number])[]) =>
    s.map(([age, v], i) => `${i ? "L" : "M"}${x(age).toFixed(1)},${y(v).toFixed(1)}`).join("");

  const gridLevels = [0, 0.5, 1].map((f) => maxV * f);
  const ageTicks = series.base
    .map(([age]) => age)
    .filter((age) => age === firstAge || (age % 5 === 0 && age - firstAge >= 3));

  return (
    <div ref={ref}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={title}
        className="block h-auto w-full overflow-visible"
      >
        {gridLevels.map((v) => (
          <g key={v}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            {need === null || Math.abs(y(v) - y(need)) > 14 ? (
              <text x={W - PAD_R + 8} y={y(v) + 4} fontSize={11} fill="var(--ink-3)">
                {v === 0 ? "0" : formatAxis(v)}
              </text>
            ) : null}
          </g>
        ))}
        {need !== null ? (
          <>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y(need)}
              y2={y(need)}
              stroke="var(--down)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
            <text x={W - PAD_R + 8} y={y(need) + 4} fontSize={11} fill="var(--down)">
              {formatAxis(need)}
            </text>
          </>
        ) : null}
        <line
          x1={x(retireAge)}
          x2={x(retireAge)}
          y1={TOP}
          y2={H - BOTTOM}
          stroke="var(--line)"
          strokeDasharray="2 3"
        />
        <clipPath id={clipId}>
          <rect x={PAD_L} y={TOP} width={W - PAD_L - PAD_R} height={H - TOP - BOTTOM} />
        </clipPath>
        <g clipPath={`url(#${clipId})`} fill="none" strokeWidth={2.2} strokeLinejoin="round">
          {(["low", "base", "high"] as const).map((k) => (
            <path key={k} d={path(series[k])} stroke={scenarioStroke[k]} />
          ))}
        </g>
        {ageTicks.map((age) => (
          <text
            key={age}
            x={x(age)}
            y={H - 6}
            fontSize={11}
            fill="var(--ink-3)"
            textAnchor={age === firstAge ? "start" : "middle"}
          >
            {age}
          </text>
        ))}
      </svg>
    </div>
  );
}
