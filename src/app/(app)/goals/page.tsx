import type { Metadata } from "next";
import Link from "next/link";
import { Disclaimer, EmptyState, PageHeader } from "@/components/page";
import { I18nProvider } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { getLocale, getT, pickMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { scopedDb } from "@/lib/db/scoped";
import { formatDate, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { loadGoals, type GoalView } from "@/lib/portfolio/goal-service";
import { loadPortfolio } from "@/lib/portfolio/ledger/load";
import { todayKey } from "@/lib/portfolio/valuation";
import { ButtonLink, dateOf, Tag } from "../assets/ui";
import { addSavedAction } from "./actions";
import { AddSavedForm } from "./goal-form";
import { ProgressBar, SavingsFigures } from "./ui";

export const metadata: Metadata = { title: "Cele" };

type T = Awaited<ReturnType<typeof getT<"goals">>>;

export default async function GoalsPage() {
  const { user } = await requireUser();
  const [t, tc, locale] = await Promise.all([getT("goals"), getT("common"), getLocale()]);
  const today = todayKey();
  const sdb = scopedDb(db(), user.id);
  const goals = await loadGoals(sdb, await loadPortfolio(sdb, today), today);

  return (
    <>
      <PageHeader
        title={t("title")}
        meta={goals.length > 0 ? t("meta", { count: goals.length }) : undefined}
        actions={goals.length > 0 ? <ButtonLink href="/goals/new">{t("newGoal")}</ButtonLink> : undefined}
      />
      <div className="lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-10">
        <div>
          {goals.length === 0 ? (
            <EmptyState
              title={t("emptyTitle")}
              body={t("emptyBody")}
              action={{ href: "/goals/new", label: t("newGoal") }}
            />
          ) : (
            <I18nProvider locale={locale} messages={pickMessages(locale, ["goals"])}>
              <ul className="mt-4 grid gap-4">
                {goals.map((g) => (
                  <li key={g.id}>
                    <GoalCard goal={g} t={t} locale={locale} />
                  </li>
                ))}
              </ul>
            </I18nProvider>
          )}
        </div>
        <section
          aria-labelledby="retirement-card"
          className="mt-6 border-t border-line pt-5 lg:mt-4 lg:border-0 lg:pt-0"
        >
          <h2 id="retirement-card" className="text-base font-semibold">
            {t("calculatorTitle")}
          </h2>
          <p className="mt-1 max-w-[60ch] text-ink-2">{t("calculatorBody")}</p>
          <Link
            href="/goals/retirement"
            className="mt-4 inline-flex rounded-[10px] border border-line bg-surface px-4 py-2.5 font-semibold text-brand"
          >
            {t("calculatorLink")}
          </Link>
        </section>
      </div>
      <Disclaimer>{tc("disclaimerResults")}</Disclaimer>
    </>
  );
}

function GoalCard({ goal: g, t, locale }: { goal: GoalView; t: T; locale: Locale }) {
  const money = (v: string) => formatMoney(v, "PLN", locale);
  const plan = g.plan;
  const source =
    g.source === "netWorth"
      ? t("sourceNetWorth")
      : g.source === "accounts"
        ? t("sourceAccounts", { names: g.accountNames.join(", ") })
        : t("sourceManual");
  return (
    <article
      className="rounded-xl border border-line bg-surface p-4 shadow-card lg:p-5"
      aria-labelledby={`goal-${g.id}`}
      data-testid="goal-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={`goal-${g.id}`} className="text-lg font-semibold break-words">
              {g.name}
            </h2>
            {g.isMain ? <Tag>{t("main")}</Tag> : null}
          </div>
          <p className="text-[13px] text-ink-3">
            {g.targetDate
              ? t("deadline", { date: formatDate(dateOf(g.targetDate), locale, "long") })
              : t("noDeadline")}
            {plan.kind === "plan" ? ` (${t("daysLeft", { days: formatNumber(plan.days, locale) })})` : ""}
          </p>
        </div>
        <Link
          href={`/goals/${g.id}`}
          className="shrink-0 text-[14px] font-semibold text-brand hover:underline"
          aria-label={`${t("edit")}: ${g.name}`}
        >
          {t("edit")}
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tracking-tight" data-amt="" data-testid="goal-current">
            {money(g.current)}
          </span>
          <span className="text-ink-2" data-amt="">
            {t("of", { target: money(g.targetAmount) })}
          </span>
        </p>
        {g.progress !== null ? (
          <span className="text-[15px] font-semibold text-up">{formatPercent(g.progress, locale)}</span>
        ) : null}
      </div>
      <div className="mt-2">
        <ProgressBar fraction={g.progress} label={g.name} />
      </div>

      <div className="mt-4">
        {plan.kind === "plan" ? (
          <>
            <SavingsFigures
              perDay={plan.perDay.toFixed()}
              perWeek={plan.perWeek.toFixed()}
              perMonth={plan.perMonth?.toFixed() ?? null}
              labels={{
                title: t("saveTitle"),
                perDay: t("perDay"),
                perWeek: t("perWeek"),
                perMonth: t("perMonth"),
              }}
              locale={locale}
            />
            <p className="mt-2 text-[13px] text-ink-3">
              {t("remaining", { amount: money(plan.remaining.toFixed()) })}{" "}
              {plan.perMonth === null ? `${t("lessThanMonth")} ` : ""}
              {t("noReturnNote")}
            </p>
          </>
        ) : plan.kind === "achieved" ? (
          <p className="text-[15px] font-medium text-up">{t("achieved")}</p>
        ) : plan.kind === "noDeadline" ? (
          <p className="text-[14px] text-ink-2">
            {t("noDeadlineHint", { amount: money(plan.remaining.toFixed()) })}
          </p>
        ) : (
          <p className="text-[14px] text-warn">
            {t("deadlinePassed", { amount: money(plan.remaining.toFixed()) })}
          </p>
        )}
      </div>

      <p className="mt-3 text-[13px] text-ink-3">{source}</p>
      {g.source === "manual" && plan.kind !== "achieved" ? (
        <div className="mt-3 border-t border-line pt-3">
          <AddSavedForm action={addSavedAction.bind(null, g.id)} />
        </div>
      ) : null}
    </article>
  );
}
