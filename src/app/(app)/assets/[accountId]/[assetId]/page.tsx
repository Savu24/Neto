import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Disclaimer } from "@/components/page";
import { I18nProvider } from "@/i18n/client";
import { getLocale, getT, pickMessages } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { scopedDb } from "@/lib/db/scoped";
import { formatDate, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { D, sum } from "@/lib/money";
import { monthlyHistory } from "@/lib/portfolio/ledger/history";
import { loadPortfolio, lotsFromRows } from "@/lib/portfolio/ledger/load";
import { tradesOf } from "@/lib/portfolio/ledger/positions";
import { addMonths, positionResult, todayKey } from "@/lib/portfolio/valuation";
import {
  bondRatesOf,
  dateFromKey,
  keyFromDate,
  loadFxTable,
  toLedgerTx,
} from "@/lib/portfolio/ledger/service";
import { positionFlags } from "../../describe";
import { BondRatesForm, DeleteTransactionButton, Hint, ManualPriceForm } from "../../forms";
import { BackLink, ButtonLink, KeyValues, Money, Row, Rows, Section, Tag, dateOf } from "../../ui";
import { ValueChart } from "./chart";

export const metadata: Metadata = { title: "Pozycja" };

export default async function PositionPage({ params }: PageProps<"/assets/[accountId]/[assetId]">) {
  const { user } = await requireUser();
  const { accountId, assetId } = await params;
  const sdb = scopedDb(db(), user.id);
  const today = todayKey();
  const [t, tt, tc, locale] = await Promise.all([
    getT("assets"),
    getT("transactions"),
    getT("common"),
    getLocale(),
  ]);

  const [view, all, asset] = await Promise.all([
    loadPortfolio(sdb, today, { accountId }),
    loadPortfolio(sdb, today),
    sdb.asset.findUnique({ where: { id: assetId }, include: { retailBondSeries: true } }),
  ]);
  const account = view.accounts[0];
  if (!account || !asset) notFound();
  const position = account.positions.find((p) => p.assetId === assetId);
  const rows = await sdb.transaction.findMany({
    where: { accountId, assetId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  if (!position && rows.length === 0) notFound();

  const holding = await sdb.holding.findFirst({ where: { accountId, assetId }, include: { lots: true } });
  const lots = holding ? lotsFromRows(holding.lots) : [];
  const isBond = asset.retailBondSeries !== null;
  const fmtDate = (key: string) => formatDate(dateOf(key), locale);
  const cur = asset.currency;

  const result =
    position?.price && position.fxRate
      ? positionResult({ lots, price: position.price, fxRate: position.fxRate })
      : null;
  const share = D(account.ownershipShare);
  const realized = sum(rows.filter((r) => r.realizedPnlBase).map((r) => r.realizedPnlBase!.toString()));
  const shareOfWealth =
    position?.valuePln && D(all.assets).gt(0) ? D(position.valuePln).div(all.assets).toFixed() : null;

  // Wykres: 12 miesięcy wartości i kosztu (tylko instrumenty rynkowe; obligacje mają wzór, nie notowania).
  let history: ReturnType<typeof monthlyHistory> = [];
  if (!isBond) {
    const from = addMonths(today, -13);
    const [prices, fx] = await Promise.all([
      sdb.priceSnapshot.findMany({
        where: { assetId, date: { gte: dateFromKey(from), lte: dateFromKey(today) } },
        orderBy: { date: "asc" },
      }),
      loadFxTable(sdb, [cur], today),
    ]);
    const trades = tradesOf([...rows].reverse().map(toLedgerTx), assetId);
    history = monthlyHistory({
      trades,
      prices: prices.map((p) => ({ date: keyFromDate(p.date), close: p.close.toString() })),
      fx,
      currency: cur,
      today,
      months: 12,
    });
  }

  const flags = position ? positionFlags(position, t, locale) : [];
  const signedTone = (v: string) => (D(v).isNeg() ? "text-down" : D(v).isZero() ? "" : "text-up");

  return (
    <I18nProvider locale={locale} messages={pickMessages(locale, ["common", "assets", "transactions"])}>
      <BackLink href={`/assets/${accountId}`}>{account.name}</BackLink>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
        <div>
          <header className="mt-2 rounded-xl border border-line bg-surface p-4 shadow-card lg:p-5">
            <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">{asset.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-3">
              <span>{[asset.symbol, asset.exchange, cur].filter(Boolean).join(", ")}.</span>
              <span>{account.name}</span>
              {account.taxWrapper !== "NONE" ? <Tag>{t(`wrapper_${account.taxWrapper}`)}</Tag> : null}
              {flags.map((f, i) => (
                <span key={i}>{f}</span>
              ))}
            </p>
            <div className="mt-3 text-3xl font-semibold tracking-tight" data-testid="position-value">
              {position?.valuePln ? (
                <Money value={position.valuePln} locale={locale} />
              ) : (
                <span className="text-warn">{t("noValuation")}</span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
              {result ? (
                <span data-testid="position-result">
                  {t("positionResult")}{" "}
                  <b className={signedTone(result.totalPln.toFixed())}>
                    {formatMoney(result.totalPln.times(share).toFixed(2), "PLN", locale, { signed: true })}
                  </b>{" "}
                  {result.totalPercent ? (
                    <span className={signedTone(result.totalPercent.toFixed())}>
                      {formatPercent(result.totalPercent.toFixed(), locale, { signed: true })}
                    </span>
                  ) : null}
                </span>
              ) : null}
              {shareOfWealth ? (
                <span>{t("shareOfWealth", { share: formatPercent(shareOfWealth, locale) })}</span>
              ) : null}
            </div>
            {position && !isBond ? (
              <p className="mt-2 text-[13px] text-ink-3">
                {position.priceDate && position.price
                  ? t("priceLine", {
                      price: formatMoney(position.price, cur, locale),
                      date: fmtDate(position.priceDate),
                    })
                  : position.priceFromTrade
                    ? t("noPriceLine")
                    : null}{" "}
                {cur !== "PLN" && position.fxRate && position.fxDate
                  ? t("fxLine", {
                      currency: cur,
                      rate: formatNumber(position.fxRate, locale, 4),
                      date: fmtDate(position.fxDate),
                    })
                  : null}
              </p>
            ) : null}
            {isBond ? <Hint>{t("bondNote")}</Hint> : null}
          </header>

          {!isBond ? (
            <Section title={t("chartTitle")}>
              <ValueChart
                points={history}
                labels={{
                  value: t("chartValue"),
                  cost: t("chartCost"),
                  alt: t("chartAlt"),
                  empty: t("chartEmpty"),
                  month: t("chartMonth"),
                }}
                locale={locale}
              />
            </Section>
          ) : null}

          <Section
            title={t("transactionsTitle")}
            action={
              !account.archived ? (
                <ButtonLink href={`/add/transaction?account=${accountId}&asset=${assetId}`}>
                  {t("addTransactionHere")}
                </ButtonLink>
              ) : undefined
            }
          >
            <Rows label={t("transactionsTitle")}>
              {rows.map((x) => {
                const name =
                  x.quantity && x.price
                    ? tt("tradeRow", {
                        type: tt(`type_${x.type}`),
                        quantity: formatNumber(x.quantity.toString(), locale, 6),
                        price: formatMoney(x.price.toString(), x.currency, locale),
                      })
                    : tt(`type_${x.type}`);
                const sub = [
                  fmtDate(keyFromDate(x.date)),
                  x.fxRate ? tt("rateSub", { rate: formatNumber(x.fxRate.toString(), locale, 4) }) : null,
                  x.realizedPnlBase
                    ? tt("realizedSub", {
                        amount: formatMoney(x.realizedPnlBase.toString(), "PLN", locale, { signed: true }),
                      })
                    : null,
                  x.note,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <Row
                    key={x.id}
                    name={name}
                    sub={sub}
                    value={
                      <>
                        <span data-amt="">
                          {formatMoney(x.amount.toString(), x.currency, locale, { signed: true })}
                        </span>
                        {!account.archived ? (
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
          </Section>
        </div>

        <aside>
          {result ? (
            <Section title={t("positionResult")}>
              <KeyValues
                items={[
                  [
                    t("value"),
                    <Money key="v" value={result.valuePln.times(share).toFixed(2)} locale={locale} />,
                  ],
                  [
                    t("costFifo"),
                    <Money key="c" value={result.costPln.times(share).toFixed(2)} locale={locale} />,
                  ],
                  [
                    t("resultTotal"),
                    <span key="t" className={signedTone(result.totalPln.toFixed())}>
                      {formatMoney(result.totalPln.times(share).toFixed(2), "PLN", locale, { signed: true })}
                    </span>,
                  ],
                  [
                    t("resultPrice"),
                    <span key="p" className={signedTone(result.priceEffectPln.toFixed())}>
                      {formatMoney(result.priceEffectPln.times(share).toFixed(2), "PLN", locale, {
                        signed: true,
                      })}
                    </span>,
                    "pl-3",
                  ],
                  [
                    t("resultFx"),
                    <span key="f" className={signedTone(result.fxEffectPln.toFixed())}>
                      {formatMoney(result.fxEffectPln.times(share).toFixed(2), "PLN", locale, {
                        signed: true,
                      })}
                    </span>,
                    "pl-3",
                  ],
                  ...(realized.isZero()
                    ? []
                    : ([
                        [
                          t("realized"),
                          formatMoney(realized.times(share).toFixed(2), "PLN", locale, { signed: true }),
                        ],
                      ] as [string, string][])),
                ]}
              />
              {cur !== "PLN" ? <Hint>{t("fxEffectNote", { currency: cur })}</Hint> : null}
            </Section>
          ) : null}
          <Section title={t("details")}>
            <KeyValues
              items={[
                [
                  t("units"),
                  position?.quantity
                    ? formatNumber(position.quantity, locale, 6)
                    : holding
                      ? formatNumber(holding.quantity.toString(), locale, 6)
                      : "—",
                ],
                ...(result?.averageCost
                  ? ([[t("avgCost"), formatMoney(result.averageCost.toFixed(), cur, locale)]] as [
                      string,
                      string,
                    ][])
                  : []),
                ...(result && cur !== "PLN"
                  ? ([
                      [t("costIn", { currency: cur }), formatMoney(result.cost.toFixed(2), cur, locale)],
                      [t("valueIn", { currency: cur }), formatMoney(result.value.toFixed(2), cur, locale)],
                    ] as [string, string][])
                  : []),
                [t("isin"), asset.isin ?? "—"],
                [t("priceSource"), t(`source_${asset.priceSource}`)],
              ]}
            />
          </Section>
          {asset.userId && asset.priceSource === "MANUAL" && !isBond ? (
            <Section title={t("setPrice")}>
              <ManualPriceForm assetId={asset.id} currency={cur} today={today} />
            </Section>
          ) : null}
          {isBond && asset.userId ? (
            <Section title={t("bondRates")}>
              <BondRatesForm
                assetId={asset.id}
                rates={bondRatesOf(asset.retailBondSeries?.periodRates)
                  .map((r) => formatNumber(D(r).times(100).toFixed(), locale, 4))
                  .join("\n")}
              />
            </Section>
          ) : null}
        </aside>
      </div>
      <Disclaimer>{tc("disclaimerResults")}</Disclaimer>
    </I18nProvider>
  );
}
