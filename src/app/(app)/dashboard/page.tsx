import type { Metadata } from "next";
import Link from "next/link";
import { Disclaimer, EmptyState, PageHeader } from "@/components/page";
import { PrivacyToggle } from "@/components/privacy-toggle";
import type { Locale, MessageKey } from "@/i18n/config";
import { getLocale, getT } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { scopedDb } from "@/lib/db/scoped";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import { D, sum } from "@/lib/money";
import { loadGoals } from "@/lib/portfolio/goal-service";
import { loadPortfolio } from "@/lib/portfolio/ledger/load";
import { loadNetWorthSeries, type SeriesPoint } from "@/lib/portfolio/ledger/net-worth-series";
import {
  addDays,
  addMonths,
  endOfMonth,
  netWorthChanges,
  todayKey,
  type NetWorthChange,
} from "@/lib/portfolio/valuation";
import { dateOf } from "../assets/ui";
import { ProgressBar } from "../goals/ui";
import { NetWorthChart } from "./chart";

export const metadata: Metadata = { title: "Pulpit" };

const RANGES = ["1m", "6m", "1y", "5y", "all"] as const;
type Range = (typeof RANGES)[number];
const ALLOCS = ["class", "currency", "account"] as const;
type Alloc = (typeof ALLOCS)[number];
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

/** Punkty dla zakresu: 1M dziennie, dłuższe zakresy na koniec miesięcy (plus dziś), żeby oś była równa. */
function pointsFor(points: readonly SeriesPoint[], range: Range, today: string): SeriesPoint[] {
  if (range === "1m") return points.filter((p) => p.date >= addDays(today, -30));
  const from = {
    "6m": addMonths(today, -6),
    "1y": addMonths(today, -12),
    "5y": addMonths(today, -60),
    all: "",
  }[range];
  return points.filter(
    (p, i) => p.date >= from && (i === 0 || p.date === today || p.date === endOfMonth(p.date)),
  );
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { user } = await requireUser();
  const sp = await searchParams;
  const range: Range = RANGES.includes(sp.range as Range) ? (sp.range as Range) : "1y";
  const alloc: Alloc = ALLOCS.includes(sp.alloc as Alloc) ? (sp.alloc as Alloc) : "class";
  const [t, ta, tc, locale] = await Promise.all([
    getT("dashboard"),
    getT("assets"),
    getT("common"),
    getLocale(),
  ]);
  const today = todayKey();
  const sdb = scopedDb(db(), user.id);
  const [portfolio, series] = await Promise.all([loadPortfolio(sdb, today), loadNetWorthSeries(sdb, today)]);

  if (portfolio.accounts.length === 0) {
    return (
      <>
        <PageHeader title={t("title")} />
        <EmptyState
          title={t("emptyTitle")}
          body={t("emptyBody")}
          action={{ href: "/add/account", label: t("emptyAction") }}
        />
        <Disclaimer>{tc("disclaimerResults")}</Disclaimer>
      </>
    );
  }

  const goals = await loadGoals(sdb, portfolio, today);
  const mainGoal = goals.find((g) => g.isMain) ?? goals[0] ?? null;
  const changes = netWorthChanges(series.points, today);
  const money = (v: string, signed = false) => formatMoney(v, "PLN", locale, { signed });
  const query = (patch: Record<string, string>) =>
    `/dashboard?${new URLSearchParams({ range, alloc, ...patch })}`;

  const assets = D(portfolio.assets);
  const liabilities = D(portfolio.liabilities);
  const scale = assets.gt(liabilities) ? assets : liabilities;
  const pct = (v: typeof assets) => (scale.gt(0) ? v.div(scale).times(100).toNumber() : 0);

  // Alokacja: 5 największych grup, reszta jako „Pozostałe”.
  const source =
    alloc === "class" ? series.byClass : alloc === "currency" ? series.byCurrency : series.byAccount;
  const accountNames = new Map(portfolio.accounts.map((a) => [a.id, a.name]));
  const groups = Object.entries(source)
    .filter(([, v]) => D(v).gt(0))
    .map(([k, v]) => ({
      key: k,
      label:
        alloc === "class"
          ? ta(`class_${k}` as MessageKey<"assets">)
          : alloc === "account"
            ? (accountNames.get(k) ?? k)
            : k,
      value: D(v),
    }))
    .sort((a, b) => b.value.cmp(a.value));
  const shown = groups.slice(0, 5);
  const rest = groups.slice(5);
  if (rest.length) shown.push({ key: "other", label: t("allocOther"), value: sum(rest.map((g) => g.value)) });
  const allocTotal = sum(shown.map((g) => g.value));

  const positions = portfolio.accounts
    .filter((a) => a.kind === "ASSET" && a.includeInNetWorth)
    .flatMap((a) => a.positions.map((p) => ({ ...p, accountName: a.name, accountId: a.id })))
    .filter((p) => p.valuePln !== null && D(p.valuePln).gt(0))
    .sort((a, b) => D(b.valuePln!).cmp(D(a.valuePln!)))
    .slice(0, 5);

  const segment = (active: boolean) =>
    `rounded-[7px] px-2.5 py-1 text-[13px] font-medium transition-colors ${
      active ? "bg-brand text-on-brand shadow-card" : "text-ink-2 hover:text-ink"
    }`;

  return (
    <>
      <PageHeader
        title={t("title")}
        meta={t("meta", { date: formatDate(dateOf(today), locale, "long") })}
        actions={<PrivacyToggle />}
      />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
        <div className="min-w-0">
          <section
            aria-labelledby="nw-label"
            className="rounded-2xl border border-line bg-surface p-5 shadow-card lg:p-6"
          >
            <p id="nw-label" className="text-[14px] font-medium text-ink-2">
              {t("netWorth")}
            </p>
            <p
              className="mt-1 text-[38px] leading-tight font-semibold tracking-[-0.03em] lg:text-[46px]"
              data-testid="dashboard-net-worth"
              data-amt=""
            >
              {money(portfolio.netWorth)}
            </p>
            <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[14px]">
              <Change
                label={t("day")}
                change={changes?.daily ?? null}
                locale={locale}
                empty={t("noChange")}
              />
              <Change
                label={t("month")}
                change={changes?.monthly ?? null}
                locale={locale}
                empty={t("noChange")}
              />
              <Change
                label={t("year")}
                change={changes?.yearly ?? null}
                locale={locale}
                empty={t("noChange")}
              />
            </dl>

            <div className="mt-5 grid gap-1.5 text-[13px]">
              <div className="flex justify-between text-ink-2">
                <span>{t("assets")}</span>
                <span className="font-medium text-ink" data-amt="">
                  {money(portfolio.assets)}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-brand" style={{ width: `${pct(assets)}%` }} />
              </div>
              {liabilities.gt(0) ? (
                <>
                  <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-[repeating-linear-gradient(45deg,var(--down)_0_4px,var(--down-soft)_4px_8px)]"
                      style={{ width: `${pct(liabilities)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-ink-2">
                    <span>{t("liabilities")}</span>
                    <span className="font-medium text-down" data-amt="">
                      {money(liabilities.neg().toFixed())}
                    </span>
                  </div>
                </>
              ) : null}
            </div>
          </section>

          <section
            aria-labelledby="history-title"
            className="mt-5 rounded-2xl border border-line bg-surface p-5 shadow-card lg:p-6"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 id="history-title" className="text-base font-semibold">
                {t("history")}
              </h2>
              <nav
                aria-label={t("rangeLabel")}
                className="inline-flex gap-0.5 rounded-[9px] border border-line bg-surface-2 p-0.5"
              >
                {RANGES.map((r) => (
                  <Link
                    key={r}
                    href={query({ range: r })}
                    aria-current={r === range ? "page" : undefined}
                    className={segment(r === range)}
                    scroll={false}
                  >
                    {t(`range_${r}`)}
                  </Link>
                ))}
              </nav>
            </div>
            <NetWorthChart
              points={pointsFor(series.points, range, today)}
              labels={{
                alt: t("chartAlt"),
                empty: t("chartEmpty"),
                assets: t("assets"),
                liabilities: t("liabilities"),
                netWorth: t("netWorth"),
                date: t("date"),
              }}
              locale={locale}
            />
          </section>

          <section
            aria-labelledby="top-title"
            className="mt-5 rounded-2xl border border-line bg-surface p-5 shadow-card lg:p-6"
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 id="top-title" className="text-base font-semibold">
                {t("topPositions")}
              </h2>
              <Link href="/assets" className="text-[14px] font-semibold text-brand hover:underline">
                {t("allAssets")}
              </Link>
            </div>
            <table className="w-full text-[14px]">
              <thead className="text-left text-[12.5px] text-ink-3">
                <tr className="border-b border-line">
                  <th scope="col" className="py-2 font-medium">
                    {t("colPosition")}
                  </th>
                  <th scope="col" className="hidden py-2 font-medium sm:table-cell">
                    {t("colAccount")}
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    {t("colValue")}
                  </th>
                  <th scope="col" className="hidden py-2 text-right font-medium sm:table-cell">
                    {t("colResult")}
                  </th>
                  <th scope="col" className="py-2 pl-3 text-right font-medium">
                    {t("colShare")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {positions.map((p) => (
                  <tr key={`${p.accountId}-${p.id}`}>
                    <td className="py-2.5 pr-2">
                      <Link
                        href={p.assetId ? `/assets/${p.accountId}/${p.assetId}` : `/assets/${p.accountId}`}
                        className="font-medium hover:text-brand"
                      >
                        {p.kind === "cash" ? p.accountName : p.name}
                      </Link>
                      <span className="block text-[12.5px] text-ink-3 sm:hidden">{p.accountName}</span>
                    </td>
                    <td className="hidden py-2.5 text-ink-2 sm:table-cell">{p.accountName}</td>
                    <td className="py-2.5 text-right whitespace-nowrap" data-amt="">
                      {money(p.valuePln!)}
                    </td>
                    <td className="hidden py-2.5 text-right sm:table-cell">
                      {p.resultPercent ? (
                        <span
                          className={
                            D(p.resultPercent).isNeg()
                              ? "text-down"
                              : D(p.resultPercent).isZero()
                                ? "text-ink-3"
                                : "text-up"
                          }
                        >
                          {formatPercent(p.resultPercent, locale, { signed: true })}
                        </span>
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pl-3 text-right text-ink-2">
                      {assets.gt(0) ? formatPercent(D(p.valuePln!).div(assets).toFixed(), locale) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <aside className="mt-5 grid content-start gap-5 lg:mt-0">
          {portfolio.staleCount > 0 ? (
            <Link
              href="/assets"
              className="flex items-center justify-between gap-3 rounded-2xl border border-warn/25 bg-warn-soft px-4 py-3 text-[14px] text-warn"
            >
              <span>{t("stale", { count: portfolio.staleCount })}</span>
              <span className="font-semibold">{t("staleAction")}</span>
            </Link>
          ) : null}

          <section
            aria-labelledby="goal-title"
            className="rounded-2xl border border-line bg-surface p-5 shadow-card"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 id="goal-title" className="text-base font-semibold">
                {t("mainGoal")}
              </h2>
              <Link href="/goals" className="text-[14px] font-semibold text-brand hover:underline">
                {t("allGoals")}
              </Link>
            </div>
            {mainGoal ? (
              <div data-testid="dashboard-goal">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium">{mainGoal.name}</p>
                  {mainGoal.progress !== null ? (
                    <p className="font-semibold">
                      {formatPercent(mainGoal.progress, locale, { fractionDigits: 0 })}
                    </p>
                  ) : null}
                </div>
                <div className="mt-2">
                  <ProgressBar fraction={mainGoal.progress} label={mainGoal.name} />
                </div>
                <p className="mt-2 text-[13px] text-ink-2" data-amt="">
                  {t("goalLine", { current: money(mainGoal.current), target: money(mainGoal.targetAmount) })}{" "}
                  {mainGoal.plan.kind === "achieved"
                    ? t("goalAchieved")
                    : mainGoal.plan.kind === "plan" && mainGoal.plan.perMonth && mainGoal.targetDate
                      ? t("goalPerMonth", {
                          amount: money(mainGoal.plan.perMonth.toFixed()),
                          date: formatDate(dateOf(mainGoal.targetDate), locale, "long"),
                        })
                      : ""}
                </p>
              </div>
            ) : (
              <>
                <p className="text-[14px] text-ink-2">{t("goalNone")}</p>
                <Link
                  href="/goals/new"
                  className="mt-3 inline-flex text-[14px] font-semibold text-brand hover:underline"
                >
                  {t("goalNoneAction")}
                </Link>
              </>
            )}
          </section>

          <section
            aria-labelledby="alloc-title"
            className="rounded-2xl border border-line bg-surface p-5 shadow-card"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 id="alloc-title" className="text-base font-semibold">
                {t("allocation")}
              </h2>
              <nav
                aria-label={t("allocLabel")}
                className="inline-flex gap-0.5 rounded-[9px] border border-line bg-surface-2 p-0.5"
              >
                {ALLOCS.map((k) => (
                  <Link
                    key={k}
                    href={query({ alloc: k })}
                    aria-current={k === alloc ? "page" : undefined}
                    className={segment(k === alloc)}
                    scroll={false}
                  >
                    {t(`alloc_${k}`)}
                  </Link>
                ))}
              </nav>
            </div>
            {allocTotal.gt(0) ? (
              <>
                <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden>
                  {shown.map((g, i) => (
                    <span
                      key={g.key}
                      style={{
                        width: `${g.value.div(allocTotal).times(100).toNumber()}%`,
                        background: COLORS[i % COLORS.length],
                      }}
                    />
                  ))}
                </div>
                <ul className="mt-3 divide-y divide-line text-[14px]">
                  {shown.map((g, i) => (
                    <li key={g.key} className="flex items-center justify-between gap-3 py-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <i
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: COLORS[i % COLORS.length] }}
                          aria-hidden
                        />
                        <span className="truncate">{g.label}</span>
                      </span>
                      <span className="font-semibold">
                        {formatPercent(g.value.div(allocTotal).toFixed(), locale)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-[14px] text-ink-2">{t("allocEmpty")}</p>
            )}
          </section>
        </aside>
      </div>
      <Disclaimer>{tc("disclaimerResults")}</Disclaimer>
    </>
  );
}

function Change({
  label,
  change,
  locale,
  empty,
}: {
  label: string;
  change: NetWorthChange | null;
  locale: Locale;
  empty: string;
}) {
  const tone =
    !change || change.amount.isZero() ? "text-ink-3" : change.amount.isNeg() ? "text-down" : "text-up";
  return (
    <div className="flex gap-1.5">
      <dt className="text-ink-2">{label}</dt>
      <dd className={`font-medium ${tone}`} data-amt="">
        {change ? (
          <>
            {formatMoney(change.amount.toFixed(), "PLN", locale, { signed: true, fractionDigits: 0 })}
            {change.percent ? ` (${formatPercent(change.percent.toFixed(), locale, { signed: true })})` : ""}
          </>
        ) : (
          empty
        )}
      </dd>
    </div>
  );
}
