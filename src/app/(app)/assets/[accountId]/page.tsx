import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Disclaimer } from "@/components/page";
import { I18nProvider } from "@/i18n/client";
import { getLocale, getT, pickMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { scopedDb } from "@/lib/db/scoped";
import { formatDate, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { D } from "@/lib/money";
import { loadPortfolio } from "@/lib/portfolio/ledger/load";
import { keyFromDate } from "@/lib/portfolio/ledger/service";
import { isTrade, valuationOf } from "@/lib/portfolio/ledger/types";
import { depositMaturity, todayKey } from "@/lib/portfolio/valuation";
import { accountSub, positionFlags, positionLabel } from "../describe";
import { CloseDepositForm, DeleteTransactionButton, Hint, QuickUpdateForm } from "../forms";
import { archiveAccountAction } from "../actions";
import { BackLink, ButtonLink, Change, KeyValues, Money, Row, Rows, Section, Tag, dateOf } from "../ui";

export const metadata: Metadata = { title: "Konto" };

export default async function AccountPage({ params }: PageProps<"/assets/[accountId]">) {
  const { user } = await requireUser();
  const { accountId } = await params;
  const sdb = scopedDb(db(), user.id);
  const today = todayKey();
  const [t, tt, tc, locale] = await Promise.all([
    getT("assets"),
    getT("transactions"),
    getT("common"),
    getLocale(),
  ]);
  const view = await loadPortfolio(sdb, today, { accountId });
  const a = view.accounts[0];
  if (!a) notFound();

  const transactions = await sdb.transaction.findMany({
    where: { accountId },
    include: { asset: { select: { name: true, symbol: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
  const payout = a.deposit?.payoutAccountId
    ? await sdb.financialAccount.findUnique({
        where: { id: a.deposit.payoutAccountId },
        select: { id: true, name: true },
      })
    : null;

  const valuation = valuationOf(a.type);
  const fmtDate = (key: string) => formatDate(dateOf(key), locale);
  const money = (v: string, c = a.currency) => formatMoney(v, c, locale);
  // Lokatę kończy formularz „Zakończ lokatę”; pozostałe konta mają formularz transakcji.
  const canTransact = !a.archived && valuation !== "deposit";
  const instruments = a.positions.filter((p) => p.kind === "market" || p.kind === "retailBond");
  const cash = a.positions.filter((p) => p.kind === "cash");

  let maturity: { date: string; amount: string } | null = null;
  if (a.deposit && !a.deposit.closed) {
    const m = depositMaturity({
      principal: a.deposit.principal,
      annualRate: a.deposit.rate,
      startDate: a.deposit.startDate,
      termMonths: a.deposit.termMonths,
      capitalization: a.deposit.capitalization,
      autoRenew: a.deposit.autoRenew,
    });
    maturity = { date: m.date, amount: m.amount.toFixed(2) };
  }

  return (
    <I18nProvider locale={locale} messages={pickMessages(locale, ["common", "assets", "transactions"])}>
      <BackLink href="/assets">{t("backToAssets")}</BackLink>
      <header className="mt-2 rounded-xl border border-line bg-surface p-4 shadow-card lg:p-5">
        <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">{a.name}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-3">
          {accountSub(a, t, locale)}
          {a.institution ? <span>· {a.institution}</span> : null}
          {a.taxWrapper !== "NONE" ? <Tag>{t(`wrapper_${a.taxWrapper}`)}</Tag> : null}
        </div>
        <div className="mt-3 text-3xl font-semibold tracking-tight" data-testid="account-value">
          <Money value={a.valuePln} locale={locale} negative={a.kind === "LIABILITY"} />
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
          {a.resultPercent ? (
            <span>
              {t("positionResult")} <Change fraction={a.resultPercent} locale={locale} />
            </span>
          ) : null}
          {D(a.ownershipShare).lt(1) ? (
            <span>
              {t("shareLabel", { share: formatPercent(a.ownershipShare, locale, { fractionDigits: 0 }) })}
            </span>
          ) : null}
          {!a.complete ? <Tag tone="warn">{t("noValuation")}</Tag> : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {canTransact ? (
            <ButtonLink href={`/add/transaction?account=${a.id}`} variant="primary">
              {t("addTransactionHere")}
            </ButtonLink>
          ) : null}
          {!a.archived && (valuation === "cash" || valuation === "investment") ? (
            <ButtonLink href={`/add/import?account=${a.id}`}>{t("importHere")}</ButtonLink>
          ) : null}
          <ButtonLink href={`/assets/${a.id}/edit`}>{t("edit")}</ButtonLink>
          <form action={archiveAccountAction}>
            <input type="hidden" name="accountId" value={a.id} />
            <input type="hidden" name="archived" value={a.archived ? "0" : "1"} />
            <button
              type="submit"
              title={a.archived ? undefined : t("archiveHint")}
              className="inline-flex rounded-[10px] border border-line bg-surface px-4 py-2.5 font-semibold text-ink-2"
            >
              {a.archived ? t("unarchive") : t("archive")}
            </button>
          </form>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
        <div>
          {valuation === "investment" ? (
            <Section title={t("positionsTitle")}>
              {instruments.length === 0 && cash.every((c) => !c.value || D(c.value).isZero()) ? (
                <p className="text-ink-2">{t("noPositions")}</p>
              ) : (
                <Rows label={t("positionsTitle")}>
                  {[...instruments, ...cash].map((p) => {
                    const flags = positionFlags(p, t, locale);
                    return (
                      <Row
                        key={p.id}
                        testId={`position-${p.assetId ?? p.id}`}
                        href={p.assetId ? `/assets/${a.id}/${p.assetId}` : undefined}
                        name={positionLabel(p, t)}
                        sub={
                          <span className="inline-flex flex-wrap gap-1.5">
                            {p.kind === "retailBond" && p.quantity && p.maturityDate ? (
                              <span>
                                {t("bondSub", {
                                  count: formatNumber(p.quantity, locale),
                                  date: fmtDate(p.maturityDate),
                                })}
                              </span>
                            ) : p.quantity ? (
                              <span>
                                {formatNumber(p.quantity, locale, 6)} ×{" "}
                                {p.price ? formatMoney(p.price, p.currency, locale) : "—"}
                              </span>
                            ) : p.currency !== "PLN" && p.value ? (
                              <span>{money(p.value, p.currency)}</span>
                            ) : null}
                            {flags.map((f, i) => (
                              <span key={i}>{f}</span>
                            ))}
                          </span>
                        }
                        value={
                          p.valuePln ? (
                            <>
                              <Money value={p.valuePln} locale={locale} />
                              {p.resultPercent ? (
                                <div>
                                  <Change fraction={p.resultPercent} locale={locale} />
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-[13px] text-warn">{t("noValuation")}</span>
                          )
                        }
                      />
                    );
                  })}
                </Rows>
              )}
            </Section>
          ) : null}

          {(valuation === "manual" || valuation === "liability") && !a.archived ? (
            <Section id="update" title={valuation === "manual" ? t("updateValuation") : t("updateBalance")}>
              <QuickUpdateForm
                accountId={a.id}
                type={valuation === "manual" ? "VALUATION" : "BALANCE_SET"}
                label={valuation === "manual" ? tt("newValue") : tt("balanceLiability")}
                submit={t("update")}
                today={today}
              />
            </Section>
          ) : null}

          <Section title={t("transactionsTitle")}>
            {transactions.length === 0 ? (
              <p className="text-ink-2">{t("noTransactions")}</p>
            ) : (
              <Rows label={t("transactionsTitle")}>
                {transactions.map((x) => {
                  const typeLabel =
                    x.type === "BALANCE_SET" && a.kind === "LIABILITY"
                      ? tt("balanceLiability")
                      : tt(`type_${x.type}`);
                  const name =
                    isTrade(x.type) && x.quantity && x.price
                      ? tt("tradeRow", {
                          type: typeLabel,
                          quantity: formatNumber(x.quantity.toString(), locale, 6),
                          price: formatMoney(x.price.toString(), x.currency, locale),
                        })
                      : typeLabel;
                  const sub = [
                    fmtDate(keyFromDate(x.date)),
                    x.asset ? (x.asset.symbol ?? x.asset.name) : null,
                    x.fxRate ? tt("rateSub", { rate: formatNumber(x.fxRate.toString(), locale, 4) }) : null,
                    x.realizedPnlBase
                      ? tt("realizedSub", {
                          amount: formatMoney(x.realizedPnlBase.toString(), "PLN", locale, { signed: true }),
                        })
                      : null,
                    x.note,
                    x.importBatchId ? tt("importedSub") : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  const signed = x.type !== "VALUATION" && x.type !== "BALANCE_SET";
                  return (
                    <Row
                      key={x.id}
                      name={name}
                      sub={sub}
                      value={
                        <>
                          <span
                            className={`${signed && D(x.amount.toString()).isNeg() ? "text-ink" : ""}`}
                            data-amt=""
                          >
                            {formatMoney(x.amount.toString(), x.currency, locale, { signed })}
                          </span>
                          {!a.archived ? (
                            <div>
                              <DeleteTransactionButton
                                transactionId={x.id}
                                label={`${name}, ${fmtDate(keyFromDate(x.date))}`}
                              />
                            </div>
                          ) : null}
                        </>
                      }
                    />
                  );
                })}
              </Rows>
            )}
          </Section>
        </div>

        <aside>
          {a.deposit ? (
            <Section title={t("details")}>
              <KeyValues
                items={[
                  [t("principal"), money(a.deposit.principal)],
                  [t("rate"), formatPercent(a.deposit.rate, locale, { fractionDigits: 2 })],
                  [t("startDate"), fmtDate(a.deposit.startDate)],
                  [t("termMonths"), String(a.deposit.termMonths)],
                  [t("capitalization"), t(`cap_${a.deposit.capitalization}`)],
                  [t("maturity"), maturity ? fmtDate(maturity.date) : "—"],
                  [t("autoRenew"), a.deposit.autoRenew ? "✓" : "—"],
                  [t("payoutAccount"), payout?.name ?? "—"],
                ]}
              />
              <Hint>{t("depositNote")}</Hint>
              {maturity && maturity.date <= today && !a.archived ? (
                <div className="mt-4 border-t border-line pt-4">
                  <h3 className="mb-1 font-semibold">{t("closeDeposit")}</h3>
                  {payout ? (
                    <>
                      <p className="mb-3 text-[13px] text-ink-3">{t("closeDepositHint")}</p>
                      <CloseDepositForm
                        accountId={a.id}
                        payoutAccountId={payout.id}
                        amount={maturity.amount}
                        date={maturity.date}
                      />
                    </>
                  ) : (
                    <p className="text-[13px] text-ink-3">{t("closeDepositNoPayout")}</p>
                  )}
                </div>
              ) : null}
            </Section>
          ) : null}
          {a.liability ? (
            <Section title={t("liabilityDetails")}>
              <KeyValues
                items={[
                  [
                    t("interestRate"),
                    a.liability.interestRate
                      ? formatPercent(a.liability.interestRate, locale, { fractionDigits: 2 })
                      : "—",
                  ],
                  [t("monthlyPayment"), a.liability.monthlyPayment ? money(a.liability.monthlyPayment) : "—"],
                  [t("endDate"), a.liability.endDate ? fmtDate(a.liability.endDate) : "—"],
                  [t("originalAmount"), a.liability.originalAmount ? money(a.liability.originalAmount) : "—"],
                ]}
              />
            </Section>
          ) : null}
          {a.positions.some((p) => p.kind === "retailBond") ? <Hint>{t("bondNote")}</Hint> : null}
        </aside>
      </div>

      <Disclaimer>{tc("disclaimerResults")}</Disclaimer>
    </I18nProvider>
  );
}
