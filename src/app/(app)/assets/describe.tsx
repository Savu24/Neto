import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { Translator } from "@/i18n/translate";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import type { AccountView, PositionView } from "@/lib/portfolio/ledger/load";
import { Tag, dateOf } from "./ui";

/** Opisy wierszy kont i pozycji (podpisy pod nazwą), wspólne dla listy Majątek i ekranu konta. */

type T = Translator<"assets">;

export function positionLabel(p: PositionView, t: T): string {
  if (p.kind === "cash") return t("cashIn", { currency: p.currency });
  return p.name;
}

/** Oznaczenia problemów z wyceną: brak ceny lub kursu („brak wyceny”, nie zero) i nieaktualne dane. */
export function positionFlags(p: PositionView, t: T, locale: Locale): ReactNode[] {
  const flags: ReactNode[] = [];
  if (p.priceFromTrade) flags.push(<Tag tone="warn">{t("noValuationTrade")}</Tag>);
  else if (p.missingPrice) flags.push(<Tag tone="warn">{t("noValuation")}</Tag>);
  if (p.missingFx) flags.push(<Tag tone="warn">{t("noFx", { currency: p.currency })}</Tag>);
  if (p.stale && p.kind === "market")
    flags.push(
      <Tag tone="warn">{t("stalePrice", { date: formatDate(dateOf(p.stale.sourceDate), locale) })}</Tag>,
    );
  if (p.checkRate) flags.push(<Tag tone="warn">{t("depositCheckRate")}</Tag>);
  if (p.bondRateMissing) flags.push(<Tag tone="warn">{t("bondRateMissing")}</Tag>);
  return flags;
}

export function accountSub(a: AccountView, t: T, locale: Locale): ReactNode {
  const parts: ReactNode[] = [];
  const main = a.positions[0];
  switch (a.type) {
    case "DEPOSIT": {
      if (a.deposit?.closed) parts.push(t("depositClosed"));
      else if (main?.maturityDate)
        parts.push(t("depositSub", { date: formatDate(dateOf(main.maturityDate), locale) }));
      break;
    }
    case "REAL_ESTATE":
    case "VEHICLE":
    case "OTHER_ASSET":
    case "MORTGAGE":
    case "LOAN":
    case "LEASE":
    case "CREDIT_CARD":
    case "OTHER_LIABILITY": {
      const manual = a.kind === "ASSET";
      if (main?.stale) {
        const date = formatDate(dateOf(main.stale.sourceDate), locale);
        parts.push(<Tag tone="warn">{t(manual ? "staleValuation" : "staleBalance", { date })}</Tag>);
      } else {
        parts.push(t(`type_${a.type}`));
      }
      if (a.liability?.monthlyPayment)
        parts.push(formatMoney(a.liability.monthlyPayment, a.currency, locale, { fractionDigits: 0 }));
      break;
    }
    default: {
      parts.push(t(`type_${a.type}`));
      const instruments = a.positions.filter((p) => p.kind === "market" || p.kind === "retailBond");
      if (instruments.length > 0) parts.push(t("positionsCount", { count: instruments.length }));
      else if (a.currency !== "PLN" && main?.value && main.fxRate) {
        parts.push(
          t("fxSub", {
            amount: formatMoney(main.value, a.currency, locale),
            rate: formatNumber(main.fxRate, locale, 4),
          }),
        );
      } else parts.push(a.currency);
    }
  }
  if (!a.includeInNetWorth) parts.push(t("notCounted"));
  if (a.archived) parts.push(<Tag>{t("archivedBadge")}</Tag>);
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-1">
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 && typeof p === "string" && typeof parts[i + 1] === "string" ? "," : ""}
        </span>
      ))}
    </span>
  );
}
