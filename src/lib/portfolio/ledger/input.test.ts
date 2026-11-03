import { describe, expect, it } from "vitest";
import { AccountInputError, parseAccountInput } from "./account-input";
import { InputError, parseTransactionInput } from "./input";
import { allowedTransactions, amountSign, ACCOUNT_TYPE_LIST, accountKind } from "./types";

const today = "2026-11-03";

function err(fn: () => unknown) {
  try {
    fn();
  } catch (e) {
    if (e instanceof InputError || e instanceof AccountInputError) return `${e.field}:${e.code}`;
    throw e;
  }
  return "ok";
}

describe("transakcja z formularza (HU-2.3)", () => {
  it("kupno: kwota = ilość × cena + prowizja, ze znakiem wypływu", () => {
    const t = parseTransactionInput(
      {
        accountId: "a",
        type: "BUY",
        date: "2026-10-10",
        assetId: "x",
        quantity: "10",
        price: "100,00",
        fee: "5",
      },
      today,
    );
    expect(t).toMatchObject({ amount: "-1005", quantity: "10", price: "100", fee: "5" });
  });

  it("sprzedaż: przychód po prowizji", () => {
    const t = parseTransactionInput(
      {
        accountId: "a",
        type: "SELL",
        date: "2026-10-20",
        assetId: "x",
        quantity: "4",
        price: "110",
        fee: "3",
      },
      today,
    );
    expect(t.amount).toBe("437");
  });

  it("znaki kwot według rodzaju", () => {
    const amount = (type: string) =>
      parseTransactionInput({ accountId: "a", type, date: today, amount: "12,5", toAccountId: "b" }, today)
        .amount;
    expect(amount("DEPOSIT")).toBe("12.5");
    expect(amount("WITHDRAWAL")).toBe("-12.5");
    expect(amount("FEE")).toBe("-12.5");
    expect(amount("TAX")).toBe("-12.5");
    expect(amount("INTEREST")).toBe("12.5");
    expect(amount("TRANSFER_OUT")).toBe("-12.5");
    expect(amount("VALUATION")).toBe("12.5");
    expect(
      parseTransactionInput({ accountId: "a", type: "BALANCE_SET", date: today, amount: "-20" }, today)
        .amount,
    ).toBe("-20");
  });

  it("czytelne błędy pól", () => {
    const base = { accountId: "a", type: "DEPOSIT", date: today, amount: "1" };
    expect(err(() => parseTransactionInput({ ...base, date: "2026-11-04" }, today))).toBe("date:dateFuture");
    expect(err(() => parseTransactionInput({ ...base, date: "2026-13-01" }, today))).toBe("date:date");
    expect(err(() => parseTransactionInput({ ...base, amount: "0" }, today))).toBe("amount:amount");
    expect(err(() => parseTransactionInput({ ...base, amount: "-5" }, today))).toBe("amount:amount");
    expect(err(() => parseTransactionInput({ ...base, type: "TRANSFER_IN" }, today))).toBe("type:type");
    expect(err(() => parseTransactionInput({ ...base, type: "BUY", quantity: "1", price: "1" }, today))).toBe(
      "assetId:asset",
    );
    expect(
      err(() =>
        parseTransactionInput(
          { ...base, type: "SELL", assetId: "x", quantity: "1", price: "1", fee: "2" },
          today,
        ),
      ),
    ).toBe("fee:fee");
    expect(err(() => parseTransactionInput({ ...base, type: "TRANSFER_OUT" }, today))).toBe(
      "toAccountId:transferTarget",
    );
    expect(err(() => parseTransactionInput({ ...base, type: "TRANSFER_OUT", toAccountId: "a" }, today))).toBe(
      "toAccountId:transferSame",
    );
  });

  it("wycena może spaść do zera", () => {
    expect(
      parseTransactionInput({ accountId: "a", type: "VALUATION", date: today, amount: "0" }, today).amount,
    ).toBe("0");
  });
});

describe("konto z formularza (HU-2.1, 2.5–2.7)", () => {
  it("domyślnie PLN, udział 100%, wliczane", () => {
    const a = parseAccountInput({ name: "Konto osobiste", type: "CHECKING" }, today, "create");
    expect(a).toMatchObject({ currency: "PLN", ownershipShare: "1", includeInNetWorth: true, opening: null });
  });

  it("udział własności i notatka; niezaznaczone „wliczaj”", () => {
    const a = parseAccountInput(
      {
        name: "Mieszkanie",
        type: "REAL_ESTATE",
        ownershipShare: "50",
        notes: "Księga wieczysta GD1G/…",
        openingAmount: "620 000",
        openingDate: "2026-06-12",
        includeInNetWorthShown: "1",
      },
      today,
      "create",
    );
    expect(a).toMatchObject({
      ownershipShare: "0.5",
      includeInNetWorth: false,
      opening: { amount: "620000", date: "2026-06-12" },
    });
  });

  it("lokata i kredyt", () => {
    const d = parseAccountInput(
      {
        name: "Lokata",
        type: "DEPOSIT",
        principal: "10 000",
        rate: "5,1",
        startDate: "2026-06-03",
        termMonths: "6",
        capitalization: "END",
      },
      today,
      "create",
    );
    expect(d.deposit).toMatchObject({ principal: "10000", rate: "0.051", termMonths: 6, autoRenew: false });
    const l = parseAccountInput(
      {
        name: "Kredyt",
        type: "MORTGAGE",
        openingAmount: "548 320,25",
        interestRate: "7,12",
        endDate: "2050-01-01",
      },
      today,
      "create",
    );
    expect(l.liability).toMatchObject({ interestRate: "0.0712", endDate: "2050-01-01" });
    expect(l.opening?.amount).toBe("548320.25");
  });

  it("błędy pól", () => {
    expect(err(() => parseAccountInput({ name: "", type: "CHECKING" }, today, "create"))).toBe("name:name");
    expect(err(() => parseAccountInput({ name: "x", type: "NOPE" }, today, "create"))).toBe("type:type");
    expect(
      err(() => parseAccountInput({ name: "x", type: "CHECKING", ownershipShare: "0" }, today, "create")),
    ).toBe("ownershipShare:share");
    expect(
      err(() => parseAccountInput({ name: "x", type: "CHECKING", currency: "zl" }, today, "create")),
    ).toBe("currency:currency");
    expect(err(() => parseAccountInput({ name: "x", type: "VEHICLE" }, today, "create"))).toBe(
      "openingAmount:value",
    );
    expect(
      err(() => parseAccountInput({ name: "x", type: "LOAN", openingAmount: "-1" }, today, "create")),
    ).toBe("openingAmount:balance");
    expect(
      err(() =>
        parseAccountInput(
          {
            name: "x",
            type: "DEPOSIT",
            principal: "1",
            rate: "5",
            startDate: today,
            termMonths: "0",
            capitalization: "END",
          },
          today,
          "create",
        ),
      ),
    ).toBe("termMonths:term");
  });
});

describe("typy kont", () => {
  it("każdy typ ma rodzaj i co najmniej jedną transakcję", () => {
    for (const t of ACCOUNT_TYPE_LIST) {
      expect(["ASSET", "LIABILITY"]).toContain(accountKind(t));
      expect(allowedTransactions(t).length).toBeGreaterThan(0);
    }
    expect(allowedTransactions("CHECKING")).not.toContain("BUY");
    expect(allowedTransactions("BROKERAGE")).toContain("SELL");
    expect(allowedTransactions("MORTGAGE")).toEqual(["BALANCE_SET"]);
    expect(amountSign("BUY")).toBe(-1);
  });
});
