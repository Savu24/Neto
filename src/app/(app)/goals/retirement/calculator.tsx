"use client";

import { useMemo, useState, useTransition } from "react";
import { Disclaimer } from "@/components/page";
import { useLocale, useT } from "@/i18n/client";
import type { Locale, MessageKey } from "@/i18n/config";
import { formatMoney } from "@/lib/format";
import { D, type Dec } from "@/lib/money";
import {
  calculateRetirement,
  HORIZON_AGE,
  scenarioKeys,
  toNominal,
  type RetirementInput,
  type RetirementResult,
  type ScenarioKey,
} from "@/lib/portfolio/retirement";
import { fields, parseAssumptions, type AssumptionValues, type Field, type FieldError } from "./assumptions";
import { RetirementChart, scenarioStroke } from "./chart";

const intlLocale: Record<Locale, string> = { pl: "pl-PL", en: "en-GB" };

const scenarioName = { low: "scenarioLow", base: "scenarioBase", high: "scenarioHigh" } as const;
const yearsKey = {
  one: "yearsOne",
  few: "yearsFew",
  many: "yearsMany",
  other: "yearsOther",
  zero: "yearsOther",
  two: "yearsOther",
} as const;

type Unit = "unitYears" | "unitPln" | "unitPlnMonth" | "unitPercentYear";
const fieldSetup: Record<Field, { unit: Unit; hint?: MessageKey<"retirement">; integer?: boolean }> = {
  currentAge: { unit: "unitYears", integer: true },
  retireAge: { unit: "unitYears", integer: true },
  startingCapital: { unit: "unitPln", hint: "startingCapitalHint" },
  monthlyContribution: { unit: "unitPlnMonth" },
  monthlySpending: { unit: "unitPlnMonth", hint: "monthlySpendingHint" },
  zusMonthly: { unit: "unitPlnMonth", hint: "zusMonthlyHint" },
  withdrawalRate: { unit: "unitPercentYear" },
  returnLow: { unit: "unitPercentYear" },
  returnBase: { unit: "unitPercentYear" },
  returnHigh: { unit: "unitPercentYear", hint: "returnsHint" },
  inflation: { unit: "unitPercentYear", hint: "inflationHint" },
};

function useFormatters() {
  const locale = useLocale();
  return useMemo(() => {
    const tag = intlLocale[locale];
    const compactMoney = new Intl.NumberFormat(tag, {
      style: "currency",
      currency: "PLN",
      notation: "compact",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const compact = new Intl.NumberFormat(tag, { notation: "compact", maximumFractionDigits: 1 });
    const percent = new Intl.NumberFormat(tag, { style: "percent", maximumFractionDigits: 2 });
    const plural = new Intl.PluralRules(tag);
    return {
      money: (v: Dec) => formatMoney(v.toFixed(2), "PLN", locale, { fractionDigits: 0 }),
      compactMoney: (v: Dec) => compactMoney.format(v.toNumber()),
      axis: (v: number) => compact.format(v),
      percent: (fraction: Dec | string | number) => percent.format(Number(fraction)),
      plural: (n: number) => yearsKey[plural.select(n) as keyof typeof yearsKey],
    };
  }, [locale]);
}

/** Kalkulator emerytury: założenia po prawej (pod spodem na telefonie), wynik liczony na bieżąco. */
export function RetirementCalculator({
  defaults,
  save,
}: {
  defaults: AssumptionValues;
  save: (values: AssumptionValues) => Promise<{ ok: boolean; message: string }>;
}) {
  const t = useT("retirement");
  const tc = useT("common");
  const [values, setValues] = useState(defaults);
  const [saving, startSaving] = useTransition();
  const [saveState, setSaveState] = useState<{ ok: boolean; message: string } | null>(null);
  const parsed = useMemo(() => parseAssumptions(values), [values]);
  const result = useMemo(() => (parsed.status === "ok" ? calculateRetirement(parsed.input) : null), [parsed]);
  const errors = parsed.status === "ok" ? {} : parsed.errors;

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-12">
      <section aria-label={t("title")} className="pt-2 pb-4">
        {parsed.status === "ok" && result ? (
          <Result input={parsed.input} result={result} />
        ) : (
          <p
            role="status"
            className="rounded-xl border border-line bg-surface px-4 py-4 text-ink-2 shadow-card"
          >
            {parsed.status === "missingAge" ? t("missingAge") : t("fixErrors")}{" "}
            <a href="#assumptions" className="font-semibold text-brand underline-offset-2 hover:underline">
              {t("goToAssumptions")}
            </a>
          </p>
        )}
        <Disclaimer>{tc("disclaimerSimulation")}</Disclaimer>
      </section>

      <section id="assumptions" aria-labelledby="assumptions-heading" className="scroll-mt-4 pt-6 lg:pt-2">
        <h2 id="assumptions-heading" className="text-base font-semibold">
          {t("assumptions")}
        </h2>
        <p className="mt-1 mb-2 text-[13px] text-ink-3">{t("assumptionsHint")}</p>
        <div>
          {fields.map((field) => (
            <AssumptionField
              key={field}
              field={field}
              value={values[field]}
              error={errors[field]}
              onChange={(v) => {
                setSaveState(null);
                setValues((prev) => ({ ...prev, [field]: v }));
              }}
            />
          ))}
        </div>
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            disabled={saving}
            aria-busy={saving}
            onClick={() => startSaving(async () => setSaveState(await save(values)))}
            className="h-11 justify-self-start rounded-[10px] bg-brand px-4 font-semibold text-on-brand shadow-card transition-colors hover:bg-brand-strong disabled:opacity-60"
          >
            {t("save")}
          </button>
          {saveState ? (
            <p
              role={saveState.ok ? "status" : "alert"}
              className={`rounded-[10px] px-3 py-2 text-sm ${saveState.ok ? "bg-brand-soft text-ink" : "bg-down-soft text-down"}`}
            >
              {saveState.message}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function AssumptionField({
  field,
  value,
  error,
  onChange,
}: {
  field: Field;
  value: string;
  error?: FieldError;
  onChange: (value: string) => void;
}) {
  const t = useT("retirement");
  const { unit, hint, integer } = fieldSetup[field];
  const id = `ret-${field}`;
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ");

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-dashed border-line py-2">
      <label htmlFor={id} className="text-sm">
        {t(field)}
      </label>
      <div className="flex items-center gap-1.5">
        <input
          id={id}
          name={field}
          type="text"
          inputMode={integer ? "numeric" : "decimal"}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className="w-28 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-right font-medium tabular-nums aria-invalid:border-down"
        />
        <span className="w-[4.75rem] text-[13px] text-ink-3">{t(unit)}</span>
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="col-span-2 text-[12.5px] text-ink-3">
          {t(hint)}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="col-span-2 text-[12.5px] font-medium text-down">
          {t(error.key, "params" in error ? error.params : undefined)}
        </p>
      ) : null}
    </div>
  );
}

function Result({ input, result }: { input: RetirementInput; result: RetirementResult }) {
  const t = useT("retirement");
  const f = useFormatters();
  const need = result.requiredCapital;
  const years = (n: number) => t(f.plural(n), { n });
  const label = (k: ScenarioKey) =>
    t("scenarioLabel", { name: t(scenarioName[k]), rate: f.percent(input.returns[k] as string) });
  const earliest = (k: ScenarioKey) => {
    const age = result.scenarios[k].earliestAge;
    return age === null ? t("notInHorizon", { age: HORIZON_AGE }) : years(age);
  };

  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-ink-2">
          {need === null ? (
            <>
              {t("intro")} {t("missingSpending")}
            </>
          ) : need.isZero() ? (
            <>
              {t("intro")} {t("needZero")}
            </>
          ) : (
            <>
              {t("intro")} {t("needLead")} <b className="text-ink tabular-nums">{f.money(need)}</b>,{" "}
              {t("needExplain", { rate: f.percent(input.withdrawalRate as string) })}
            </>
          )}
        </p>
        <a href="#assumptions" className="shrink-0 text-sm text-brand lg:hidden">
          {t("changeAssumptions")}
        </a>
      </div>
      {need !== null && !need.isZero() && !D(input.inflation).isZero() ? (
        <p className="mt-1 text-[13px] text-ink-3">
          {t("needNominal", {
            inflation: f.percent(input.inflation as string),
            age: input.retireAge,
            amount: f.money(toNominal(need, input.inflation, input.retireAge - input.currentAge)),
          })}
        </p>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {need === null
          ? scenarioKeys
              .map((k) => `${label(k)}: ${f.money(result.scenarios[k].capitalAtRetirement)}`)
              .join("; ")
          : scenarioKeys.map((k) => `${label(k)}: ${earliest(k)}`).join("; ")}
      </p>

      <ul className="my-3.5 grid gap-2.5 sm:grid-cols-3">
        {scenarioKeys.map((k) => {
          const s = result.scenarios[k];
          const capital = t("capitalAt", {
            amount: f.compactMoney(s.capitalAtRetirement),
            age: input.retireAge,
          });
          return (
            <li
              key={k}
              data-scenario={k}
              className="flex items-start justify-between gap-3 rounded-[10px] border border-line bg-surface px-3 py-2.5 sm:block"
            >
              <div>
                <span className="text-[12.5px] text-ink-2">{label(k)}</span>
                <p className="text-[17px] font-semibold tabular-nums">
                  {need === null ? (
                    f.compactMoney(s.capitalAtRetirement)
                  ) : (
                    <>
                      <span className="sr-only">{t("earliestAge")} </span>
                      {earliest(k)}
                    </>
                  )}
                </p>
              </div>
              <p
                className={`text-right text-[12.5px] sm:text-left ${
                  s.sufficient === null ? "text-ink-2" : s.sufficient ? "text-up" : "text-down"
                }`}
              >
                {need === null ? t("atAge", { age: input.retireAge }) : capital}
                {need !== null ? (
                  <>
                    <br />
                    {s.sufficient
                      ? t("sufficient")
                      : t("shortfall", { amount: f.compactMoney(need.minus(s.capitalAtRetirement)) })}
                  </>
                ) : null}
              </p>
            </li>
          );
        })}
      </ul>

      <RetirementChart
        result={result}
        retireAge={input.retireAge}
        title={t("chartTitle", { from: input.currentAge, to: HORIZON_AGE })}
        formatAxis={f.axis}
      />
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
        {scenarioKeys.map((k) => (
          <li key={k} className="flex items-center gap-1.5">
            <i
              aria-hidden
              className="inline-block h-[3px] w-3.5 rounded-sm"
              style={{ background: scenarioStroke[k] }}
            />
            {t("legendScenario", { name: t(scenarioName[k]), rate: f.percent(input.returns[k] as string) })}
          </li>
        ))}
        {need !== null ? (
          <li className="flex items-center gap-1.5">
            <i
              aria-hidden
              className="inline-block h-0.5 w-3.5"
              style={{
                background: "repeating-linear-gradient(90deg, var(--down) 0 4px, transparent 4px 7px)",
              }}
            />
            {t("legendNeed")}
          </li>
        ) : null}
      </ul>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-brand">{t("tableToggle")}</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-[13px] tabular-nums">
            <caption className="pb-2 text-left text-ink-3">
              {need === null ? t("tableCaptionNoNeed") : t("tableCaption", { need: f.money(need) })}
            </caption>
            <thead>
              <tr className="border-b border-line text-ink-2">
                <th scope="col" className="py-1.5 pr-3 text-left font-medium">
                  {t("tableAge")}
                </th>
                {scenarioKeys.map((k) => (
                  <th key={k} scope="col" className="py-1.5 pl-3 text-right font-medium">
                    {label(k)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.scenarios.base.series.map((point, i) => (
                <tr key={point.age} className="border-b border-line/60">
                  <th scope="row" className="py-1 pr-3 text-left font-normal">
                    {point.age}
                  </th>
                  {scenarioKeys.map((k) => (
                    <td key={k} className="py-1 pl-3 text-right whitespace-nowrap">
                      {f.money(result.scenarios[k].series[i].capital)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
