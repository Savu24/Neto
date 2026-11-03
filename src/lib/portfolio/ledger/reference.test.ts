import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { readCsv } from "../import/csv";
import { rowsToDrafts, suggestMapping } from "../import/mapping";
import { netWorthAt, positionResult, applyFifo } from "@/lib/portfolio/valuation";
import { toAccountInput, type LedgerTransaction } from "./positions";

/**
 * Zestaw referencyjny Etapu 5 (docs/referencje/majatek.md): ten sam scenariusz sprawdza test e2e
 * `e2e/assets.spec.ts` na ekranach. Tu liczymy go czystymi funkcjami, bez bazy.
 */

const today = "2026-11-03";
let n = 0;
const tx = (
  t: Omit<LedgerTransaction, "id" | "assetId" | "quantity" | "price" | "fxRate" | "fee" | "currency"> &
    Partial<LedgerTransaction>,
): LedgerTransaction => ({
  id: `r${++n}`,
  assetId: null,
  quantity: null,
  price: null,
  fxRate: null,
  fee: null,
  currency: "PLN",
  ...t,
});

describe("zestaw referencyjny Majątek (Etap 5)", () => {
  it("konto osobiste z importem przykładowego CSV i IKE z kupnem i sprzedażą", () => {
    const file = readCsv(readFileSync(path.resolve("e2e/data/wyciag-przyklad.csv")));
    const mapping = suggestMapping(file.headers, file.rows);
    const drafts = rowsToDrafts(file.headers, file.rows, mapping, {
      accountType: "CHECKING",
      today,
      lines: file.lines,
    });
    expect(drafts.every((d) => d.ok)).toBe(true);

    const checking = toAccountInput(
      {
        id: "konto",
        type: "CHECKING",
        currency: "PLN",
        ownershipShare: "1",
        includeInNetWorth: true,
        transactions: [
          tx({ type: "BALANCE_SET", date: "2026-10-01", amount: "10000" }),
          ...drafts.map((d) =>
            d.ok ? tx({ type: d.draft.type, date: d.draft.date, amount: d.draft.amount }) : null!,
          ),
        ],
      },
      { assets: new Map(), prices: new Map() },
    );

    const trades = [
      tx({
        type: "BUY",
        date: "2026-10-10",
        assetId: "etf",
        quantity: "10",
        price: "100",
        fee: "5",
        amount: "-1005",
      }),
      tx({
        type: "SELL",
        date: "2026-10-20",
        assetId: "etf",
        quantity: "4",
        price: "110",
        fee: "3",
        amount: "437",
      }),
    ];
    const ike = toAccountInput(
      {
        id: "ike",
        type: "BROKERAGE",
        currency: "PLN",
        ownershipShare: "1",
        includeInNetWorth: true,
        transactions: trades,
      },
      {
        assets: new Map([["etf", { id: "etf", assetClass: "ETF", currency: "PLN" }]]),
        prices: new Map([["etf", [{ date: today, close: "120" }]]]),
      },
    );

    const nw = netWorthAt([checking, ike], today, {});
    const byId = Object.fromEntries(nw.accounts.map((a) => [a.id, a.valuePln.toFixed(2)]));
    expect(byId).toEqual({ konto: "15837.50", ike: "1157.00" });
    expect(nw.netWorth.toFixed(2)).toBe("16994.50");

    const fifo = applyFifo(
      trades.map((t) => ({
        id: t.id,
        type: t.type as "BUY" | "SELL",
        date: t.date,
        quantity: t.quantity!,
        price: t.price!,
        fee: t.fee!,
      })),
      { currency: "PLN" },
    );
    expect(fifo.sales[0].realizedPln.toFixed(2)).toBe("35.00");
    const r = positionResult({ lots: fifo.lots, price: "120", fxRate: "1" });
    expect(r.costPln.toFixed(2)).toBe("603.00");
    expect(r.valuePln.toFixed(2)).toBe("720.00");
    expect(r.totalPln.toFixed(2)).toBe("117.00");
    expect(r.totalPercent!.times(100).toFixed(1)).toBe("19.4");
  });
});
