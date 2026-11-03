import type { Metadata } from "next";
import Link from "next/link";
import { Disclaimer, EmptyState, PageHeader } from "@/components/page";
import { PrivacyToggle } from "@/components/privacy-toggle";
import { getLocale, getT } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { scopedDb } from "@/lib/db/scoped";
import { formatDate } from "@/lib/format";
import { D, sum } from "@/lib/money";
import { loadPortfolio, type AccountView, type PositionView } from "@/lib/portfolio/ledger/load";
import { ACCOUNT_GROUPS } from "@/lib/portfolio/ledger/types";
import { todayKey } from "@/lib/portfolio/valuation";
import { accountSub, positionFlags, positionLabel } from "./describe";
import { ButtonLink, Change, Money, Row, Rows, dateOf } from "./ui";

export const metadata: Metadata = { title: "Majątek" };

const CLASS_ORDER = [
  "CASH",
  "DEPOSIT",
  "EQUITY",
  "ETF",
  "FUND",
  "BOND",
  "RETAIL_BOND",
  "CRYPTO",
  "COMMODITY",
  "OTHER",
  "REAL_ESTATE",
  "VEHICLE",
  "OTHER_ASSET",
  "LIABILITY",
] as const;

export default async function AssetsPage({ searchParams }: PageProps<"/assets">) {
  const { user } = await requireUser();
  const sp = await searchParams;
  const byClass = sp.group === "classes";
  const archived = sp.archived === "1";
  const [t, tc, locale] = await Promise.all([getT("assets"), getT("common"), getLocale()]);
  const today = todayKey();
  const view = await loadPortfolio(scopedDb(db(), user.id), today, { archived });
  const accounts = view.accounts;

  if (accounts.length === 0 && !archived) {
    return (
      <>
        <PageHeader title={t("title")} />
        <EmptyState
          title={t("emptyTitle")}
          body={t("emptyBody")}
          action={{ href: "/add/account", label: t("addAccount") }}
        />
        {view.archivedCount > 0 ? (
          <Link href="/assets?archived=1" className="mt-4 inline-flex text-[13px] text-brand">
            {t("showArchived", { count: view.archivedCount })}
          </Link>
        ) : null}
        <Disclaimer>{tc("disclaimerResults")}</Disclaimer>
      </>
    );
  }

  const toUpdate = accounts.flatMap((a) =>
    a.type !== "DEPOSIT" && a.positions[0]?.stale && (a.kind === "LIABILITY" || a.group === "property")
      ? [{ account: a, days: a.positions[0].stale.age }]
      : [],
  );
  const segment = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-[13px] font-medium ${active ? "bg-surface text-ink shadow-sm" : "text-ink-2"}`;
  const query = (group: string) =>
    `/assets?${new URLSearchParams({ ...(group === "classes" ? { group } : {}), ...(archived ? { archived: "1" } : {}) })}`;

  return (
    <>
      <PageHeader
        title={archived ? t("archivedTitle") : t("title")}
        meta={t("meta", { count: accounts.length, date: formatDate(dateOf(today), locale, "long") })}
        actions={<PrivacyToggle />}
      />

      {!archived ? (
        <div
          className="grid grid-cols-3 gap-3 rounded-xl border border-line bg-surface p-4 shadow-card"
          aria-label={t("title")}
        >
          <Total label={t("totalsAssets")}>
            <Money value={view.assets} locale={locale} />
          </Total>
          <Total label={t("totalsLiabilities")}>
            <Money
              value={view.liabilities}
              locale={locale}
              negative
              className={D(view.liabilities).isZero() ? "" : "text-down"}
            />
          </Total>
          <Total label={t("totalsNet")} testId="net-worth">
            <Money value={view.netWorth} locale={locale} />
          </Total>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label={t("groupBy")} className="inline-flex rounded-[10px] bg-line/60 p-0.5">
          <Link
            href={query("accounts")}
            aria-current={!byClass ? "page" : undefined}
            className={segment(!byClass)}
          >
            {t("groupAccounts")}
          </Link>
          <Link
            href={query("classes")}
            aria-current={byClass ? "page" : undefined}
            className={segment(byClass)}
          >
            {t("groupClasses")}
          </Link>
        </div>
        {archived ? (
          <Link href="/assets" className="text-[13px] text-brand">
            {t("hideArchived")}
          </Link>
        ) : view.archivedCount > 0 ? (
          <Link href="/assets?archived=1" className="text-[13px] text-brand">
            {t("showArchived", { count: view.archivedCount })}
          </Link>
        ) : null}
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8">
        <div>
          {archived && accounts.length === 0 ? <p className="mt-4 text-ink-2">{t("archivedEmpty")}</p> : null}
          {byClass ? (
            <ClassGroups accounts={accounts} t={t} locale={locale} />
          ) : (
            <AccountGroups accounts={accounts} t={t} locale={locale} />
          )}
        </div>

        <aside className="mt-6 lg:mt-4">
          <section className="hidden rounded-xl border border-line bg-surface p-4 shadow-card lg:block">
            <h2 className="mb-3 text-base font-semibold">{t("addTitle")}</h2>
            <div className="grid gap-2">
              <ButtonLink href="/add/transaction" variant="primary">
                {t("addTransaction")}
              </ButtonLink>
              <ButtonLink href="/add/account">{t("addAccountOrAsset")}</ButtonLink>
              <ButtonLink href="/add/import">{t("addImport")}</ButtonLink>
            </div>
          </section>
          {toUpdate.length > 0 ? (
            <section className="mt-4 rounded-xl border border-line bg-surface p-4 shadow-card">
              <h2 className="mb-1 text-base font-semibold">{t("toUpdateTitle")}</h2>
              <Rows>
                {toUpdate.map(({ account, days }) => (
                  <Row
                    key={account.id}
                    name={account.name}
                    sub={t("toUpdateAgo", { days })}
                    value={
                      <Link href={`/assets/${account.id}#update`} className="text-[14px] text-brand">
                        {t("update")}
                      </Link>
                    }
                  />
                ))}
              </Rows>
            </section>
          ) : null}
        </aside>
      </div>

      <Disclaimer>{tc("disclaimerResults")}</Disclaimer>
    </>
  );
}

function Total({ label, children, testId }: { label: string; children: React.ReactNode; testId?: string }) {
  return (
    <div className="min-w-0" data-testid={testId}>
      <div className="text-[12.5px] text-ink-3">{label}</div>
      <div className="truncate text-[15px] font-semibold sm:text-lg">{children}</div>
    </div>
  );
}

type Props = {
  accounts: readonly AccountView[];
  t: Awaited<ReturnType<typeof getT<"assets">>>;
  locale: Awaited<ReturnType<typeof getLocale>>;
};

function AccountValue({ a, locale, t }: { a: AccountView } & Omit<Props, "accounts">) {
  return (
    <>
      <Money
        value={a.valuePln}
        locale={locale}
        negative={a.kind === "LIABILITY"}
        className={a.kind === "LIABILITY" ? "text-down" : "font-medium"}
      />
      {a.resultPercent ? (
        <div>
          <Change fraction={a.resultPercent} locale={locale} />
        </div>
      ) : null}
      {!a.complete ? <div className="text-[12px] text-warn">{t("noValuation")}</div> : null}
    </>
  );
}

function AccountGroups({ accounts, t, locale }: Props) {
  return (
    <>
      {ACCOUNT_GROUPS.map((group) => {
        const list = accounts.filter((a) => a.group === group);
        if (list.length === 0) return null;
        const total = sum(list.filter((a) => a.includeInNetWorth).map((a) => a.valuePln)).toFixed();
        return (
          <section
            key={group}
            className="mt-4 rounded-xl border border-line bg-surface px-4 py-3 shadow-card"
            aria-labelledby={`g-${group}`}
          >
            <div className="flex items-center justify-between gap-3 border-b border-line pb-2">
              <h2 id={`g-${group}`} className="text-[15px] font-semibold">
                {t(`group_${group}`)}
              </h2>
              <Money
                value={total}
                locale={locale}
                negative={group === "liabilities"}
                className="text-[14px] text-ink-2"
              />
            </div>
            <Rows>
              {list.map((a) => {
                const instruments = a.positions.filter((p) => p.kind === "market" || p.kind === "retailBond");
                return (
                  <Row
                    key={a.id}
                    testId={`account-${a.id}`}
                    href={`/assets/${a.id}`}
                    name={
                      <>
                        {a.name}
                        {a.taxWrapper !== "NONE" ? (
                          <span className="ml-1.5 align-middle text-[12px] font-medium text-brand">
                            {t(`wrapper_${a.taxWrapper}`)}
                          </span>
                        ) : null}
                      </>
                    }
                    sub={accountSub(a, t, locale)}
                    value={<AccountValue a={a} t={t} locale={locale} />}
                  >
                    {instruments.length > 0 ? (
                      <ul className="mt-1.5 ml-3 grid gap-1 border-l border-line pl-3 text-[14px]">
                        {instruments.map((p) => (
                          <PositionLine key={p.id} p={p} accountId={a.id} t={t} locale={locale} />
                        ))}
                      </ul>
                    ) : null}
                  </Row>
                );
              })}
            </Rows>
          </section>
        );
      })}
    </>
  );
}

function PositionLine({
  p,
  accountId,
  t,
  locale,
}: { p: PositionView; accountId: string } & Omit<Props, "accounts">) {
  const flags = positionFlags(p, t, locale);
  return (
    <li className="flex items-start justify-between gap-3">
      <span className="min-w-0">
        {p.assetId ? (
          <Link href={`/assets/${accountId}/${p.assetId}`} className="hover:text-brand hover:underline">
            {positionLabel(p, t)}
          </Link>
        ) : (
          positionLabel(p, t)
        )}
        {flags.map((f, i) => (
          <span key={i} className="ml-1.5">
            {f}
          </span>
        ))}
      </span>
      {p.valuePln ? (
        <Money value={p.valuePln} locale={locale} className="shrink-0 text-ink-2" />
      ) : (
        <span className="text-ink-3">—</span>
      )}
    </li>
  );
}

function ClassGroups({ accounts, t, locale }: Props) {
  const entries = accounts.flatMap((a) =>
    a.positions
      .filter((p) => !(p.kind === "cash" && p.value !== null && D(p.value).isZero()))
      .map((p) => ({ a, p, cls: a.kind === "LIABILITY" ? "LIABILITY" : p.assetClass })),
  );
  return (
    <>
      {CLASS_ORDER.map((cls) => {
        const list = entries.filter((e) => e.cls === cls);
        if (list.length === 0) return null;
        const total = sum(
          list.filter((e) => e.a.includeInNetWorth && e.p.valuePln).map((e) => e.p.valuePln!),
        ).toFixed();
        return (
          <section
            key={cls}
            className="mt-4 rounded-xl border border-line bg-surface px-4 py-3 shadow-card"
            aria-labelledby={`c-${cls}`}
          >
            <div className="flex items-center justify-between gap-3 border-b border-line pb-2">
              <h2 id={`c-${cls}`} className="text-[15px] font-semibold">
                {t(`class_${cls}`)}
              </h2>
              <Money
                value={total}
                locale={locale}
                negative={cls === "LIABILITY"}
                className="text-[14px] text-ink-2"
              />
            </div>
            <Rows>
              {list.map(({ a, p }) => {
                const flags = positionFlags(p, t, locale);
                return (
                  <Row
                    key={`${a.id}-${p.id}`}
                    href={p.assetId ? `/assets/${a.id}/${p.assetId}` : `/assets/${a.id}`}
                    name={p.kind === "cash" || !p.assetId ? a.name : positionLabel(p, t)}
                    sub={
                      <span className="inline-flex flex-wrap gap-1.5">
                        <span>{p.kind === "cash" || !p.assetId ? t(`type_${a.type}`) : a.name}</span>
                        {flags.map((f, i) => (
                          <span key={i}>{f}</span>
                        ))}
                      </span>
                    }
                    value={
                      p.valuePln ? (
                        <Money
                          value={p.valuePln}
                          locale={locale}
                          negative={cls === "LIABILITY"}
                          className={cls === "LIABILITY" ? "text-down" : ""}
                        />
                      ) : (
                        <span className="text-[13px] text-warn">{t("noValuation")}</span>
                      )
                    }
                  />
                );
              })}
            </Rows>
          </section>
        );
      })}
    </>
  );
}
