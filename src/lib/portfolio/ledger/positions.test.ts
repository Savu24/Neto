import { describe, expect, it } from "vitest";
import { netWorthAt, valueAccount } from "@/lib/portfolio/valuation";
import {
  cashFlowsByCurrency,
  toAccountInput,
  type LedgerAccount,
  type LedgerAsset,
  type LedgerContext,
  type LedgerTransaction,
} from "./positions";

let seq = 0;
function tx(
  t: Partial<LedgerTransaction> & Pick<LedgerTransaction, "type" | "date" | "amount">,
): LedgerTransaction {
  return {
    id: `t${++seq}`,
    assetId: null,
    quantity: null,
    price: null,
    currency: "PLN",
    fxRate: null,
    fee: null,
    ...t,
  };
}

function account(a: Partial<LedgerAccount> & Pick<LedgerAccount, "type" | "transactions">): LedgerAccount {
  return { id: `a${++seq}`, currency: "PLN", ownershipShare: "1", includeInNetWorth: true, ...a };
}

const etf: LedgerAsset = { id: "etf", assetClass: "ETF", currency: "PLN" };
const ctx = (
  prices: Record<string, { date: string; close: string }[]> = {},
  assets = [etf],
): LedgerContext => ({
  assets: new Map(assets.map((a) => [a.id, a])),
  prices: new Map(Object.entries(prices)),
});

const buy = (date: string, quantity: string, price: string, fee = "0", assetId = "etf") =>
  tx({
    type: "BUY",
    date,
    assetId,
    quantity,
    price,
    fee,
    amount: `-${(Number(quantity) * Number(price) + Number(fee)).toFixed(2)}`,
  });
const sell = (date: string, quantity: string, price: string, fee = "0", assetId = "etf") =>
  tx({
    type: "SELL",
    date,
    assetId,
    quantity,
    price,
    fee,
    amount: (Number(quantity) * Number(price) - Number(fee)).toFixed(2),
  });

describe("gotówka konta (przepływy)", () => {
  it("wpłaty, wypłaty, opłaty i korekta salda w kolejności zapisu", () => {
    const flows = cashFlowsByCurrency([
      tx({ type: "BALANCE_SET", date: "2026-10-01", amount: "1000" }),
      tx({ type: "WITHDRAWAL", date: "2026-10-01", amount: "-100" }),
      tx({ type: "DEPOSIT", date: "2026-10-02", amount: "50" }),
      tx({ type: "FEE", date: "2026-10-03", amount: "-5" }),
    ]);
    // w obrębie dnia kolejność zapisu: saldo 1000, potem wypłata → 900
    const v = valueAccount(
      toAccountInput(
        account({
          type: "CHECKING",
          transactions: [
            tx({ type: "BALANCE_SET", date: "2026-10-01", amount: "1000" }),
            tx({ type: "WITHDRAWAL", date: "2026-10-01", amount: "-100" }),
            tx({ type: "DEPOSIT", date: "2026-10-02", amount: "50" }),
            tx({ type: "FEE", date: "2026-10-03", amount: "-5" }),
          ],
        }),
        ctx(),
      ),
      "2026-10-03",
      {},
    );
    expect(flows.get("PLN")).toHaveLength(4);
    expect(v.valuePln.toFixed(2)).toBe("945.00");
  });

  it("kupno bez wpłaty nie robi ujemnej gotówki, a sprzedaż daje gotówkę", () => {
    const acc = account({
      type: "BROKERAGE",
      transactions: [buy("2026-10-10", "10", "100", "5"), sell("2026-10-20", "4", "110", "3")],
    });
    const v = valueAccount(
      toAccountInput(acc, ctx({ etf: [{ date: "2026-11-02", close: "120" }] })),
      "2026-11-02",
      {},
    );
    const cash = v.positions.find((p) => p.kind === "cash")!;
    const market = v.positions.find((p) => p.kind === "market")!;
    expect(cash.value!.toFixed(2)).toBe("437.00");
    expect(market.value!.toFixed(2)).toBe("720.00");
    expect(v.valuePln.toFixed(2)).toBe("1157.00");
  });

  it("kupno zużywa najpierw dostępną gotówkę, reszta to dopłata z zewnątrz", () => {
    const acc = account({
      type: "BROKERAGE",
      transactions: [
        tx({ type: "DEPOSIT", date: "2026-10-01", amount: "300" }),
        buy("2026-10-02", "5", "100"),
      ],
    });
    const v = valueAccount(
      toAccountInput(acc, ctx({ etf: [{ date: "2026-10-02", close: "100" }] })),
      "2026-10-02",
      {},
    );
    expect(v.positions.find((p) => p.kind === "cash")!.value!.toFixed(2)).toBe("0.00");
    expect(v.valuePln.toFixed(2)).toBe("500.00");
  });

  it("wpłata z tego samego dnia co kupno finansuje kupno niezależnie od kolejności zapisu", () => {
    const acc = account({
      type: "BROKERAGE",
      transactions: [
        buy("2026-10-02", "5", "100"),
        tx({ type: "DEPOSIT", date: "2026-10-02", amount: "500" }),
      ],
    });
    const v = valueAccount(
      toAccountInput(acc, ctx({ etf: [{ date: "2026-10-02", close: "100" }] })),
      "2026-10-02",
      {},
    );
    expect(v.valuePln.toFixed(2)).toBe("500.00");
  });

  it("dywidenda w obcej walucie to osobna pozycja gotówki", () => {
    const acc = account({
      type: "BROKERAGE",
      transactions: [
        tx({ type: "DIVIDEND", date: "2026-10-05", amount: "10", currency: "USD", assetId: "etf" }),
      ],
    });
    const v = valueAccount(toAccountInput(acc, ctx()), "2026-10-05", {
      USD: [{ date: "2026-10-05", rate: "4" }],
    });
    expect(v.positions.map((p) => p.id).sort()).toEqual(["cash:PLN", "cash:USD"]);
    expect(v.valuePln.toFixed(2)).toBe("40.00");
  });
});

describe("rodzaje kont", () => {
  it("brak notowania: wartość z ceny transakcji z oznaczeniem, nie zero", () => {
    const acc = account({ type: "BROKERAGE", transactions: [buy("2026-10-10", "2", "50")] });
    const v = valueAccount(toAccountInput(acc, ctx()), "2026-11-02", {});
    const market = v.positions.find((p) => p.kind === "market")!;
    expect(market.priceFromTrade).toBe(true);
    expect(market.value!.toFixed(2)).toBe("100.00");
  });

  it("brak kursu waluty: pozycja bez wartości w PLN i zgłoszony problem", () => {
    const usd: LedgerAsset = { id: "usd", assetClass: "EQUITY", currency: "USD" };
    const acc = account({ type: "BROKERAGE", transactions: [buy("2026-10-10", "1", "10", "0", "usd")] });
    const v = valueAccount(
      toAccountInput(acc, ctx({ usd: [{ date: "2026-10-10", close: "10" }] }, [usd])),
      "2026-10-10",
      {},
    );
    const market = v.positions.find((p) => p.id === "asset:usd")!;
    expect(market.valuePln).toBeNull();
    expect(market.issues.some((i) => i.type === "missingFx")).toBe(true);
    expect(v.complete).toBe(false);
  });

  it("aktywo ręczne: ostatnia wycena ≤ D; zobowiązanie odejmuje się od wartości netto", () => {
    const flat = account({
      type: "REAL_ESTATE",
      ownershipShare: "0.5",
      transactions: [
        tx({ type: "VALUATION", date: "2026-01-10", amount: "600000" }),
        tx({ type: "VALUATION", date: "2026-06-12", amount: "620000" }),
      ],
    });
    const loan = account({
      type: "MORTGAGE",
      transactions: [tx({ type: "BALANCE_SET", date: "2026-11-01", amount: "250000" })],
    });
    const nw = netWorthAt([toAccountInput(flat, ctx()), toAccountInput(loan, ctx())], "2026-11-02", {});
    expect(nw.assets.toFixed(2)).toBe("310000.00");
    expect(nw.liabilities.toFixed(2)).toBe("250000.00");
    expect(nw.netWorth.toFixed(2)).toBe("60000.00");
  });

  it("lokata: wartość z wzoru, po przelewie zamykającym zero", () => {
    const dep = account({
      type: "DEPOSIT",
      deposit: {
        principal: "10000",
        rate: "0.05",
        startDate: "2026-01-01",
        termMonths: 12,
        capitalization: "END",
        autoRenew: false,
      },
      transactions: [],
    });
    const open = valueAccount(toAccountInput(dep, ctx()), "2026-07-01", {});
    expect(open.valuePln.gt(10000)).toBe(true);
    const closed = valueAccount(
      toAccountInput(
        { ...dep, transactions: [tx({ type: "TRANSFER_OUT", date: "2027-01-01", amount: "-10500" })] },
        ctx(),
      ),
      "2027-01-02",
      {},
    );
    expect(closed.valuePln.toFixed(2)).toBe("0.00");
  });

  it("obligacje: każda partia liczona od własnej daty zakupu, sprzedaż (wykup) zmniejsza partie FIFO", () => {
    const edo: LedgerAsset = {
      id: "edo",
      assetClass: "RETAIL_BOND",
      currency: "PLN",
      bond: { type: "EDO", periodRates: ["0.0675"] },
    };
    const acc = account({
      type: "RETAIL_BONDS",
      transactions: [
        buy("2026-01-15", "10", "100", "0", "edo"),
        buy("2026-02-15", "5", "100", "0", "edo"),
        sell("2026-03-01", "4", "100", "0", "edo"),
      ],
    });
    const input = toAccountInput(acc, ctx({}, [edo]));
    const bonds = input.positions.filter((p) => p.kind === "retailBond");
    expect(bonds).toHaveLength(2);
    const v = valueAccount(input, "2027-01-15", {});
    // partia z 15.01.2026: 6 szt. po roku = 6 × 106,75
    const first = v.positions.find((p) => p.id === "bond:edo:0")!;
    expect(first.value!.toFixed(2)).toBe("640.50");
  });
});
