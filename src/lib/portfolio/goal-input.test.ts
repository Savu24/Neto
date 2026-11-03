import { describe, expect, it } from "vitest";
import { GoalInputError, parseGoalInput } from "./goal-input";

const today = "2026-11-03";

function code(fields: Record<string, string>, accountIds: string[] = []) {
  try {
    parseGoalInput(fields, accountIds, today);
    return "ok";
  } catch (e) {
    if (e instanceof GoalInputError) return `${e.field}:${e.code}`;
    throw e;
  }
}

describe("parseGoalInput", () => {
  it("cel od zera: 50 000 zł za 3 lata", () => {
    expect(
      parseGoalInput({ name: " Samochód ", targetAmount: "50 000", targetDate: "2029-11-03" }, [], today),
    ).toEqual({
      name: "Samochód",
      targetAmount: "50000",
      targetDate: "2029-11-03",
      source: "manual",
      savedAmount: null,
      accountIds: [],
      isMain: false,
    });
  });

  it("przecinek dziesiętny, odłożona kwota i cel główny", () => {
    const input = parseGoalInput(
      { name: "Wakacje", targetAmount: "8000,50", source: "manual", savedAmount: "1 200,25", isMain: "on" },
      [],
      today,
    );
    expect(input).toMatchObject({
      targetAmount: "8000.5",
      savedAmount: "1200.25",
      isMain: true,
      targetDate: null,
    });
  });

  it("konta: bez duplikatów; inne źródła ignorują konta i kwotę odłożoną", () => {
    expect(
      parseGoalInput({ name: "A", targetAmount: "1", source: "accounts" }, ["a1", "a1", "a2"], today)
        .accountIds,
    ).toEqual(["a1", "a2"]);
    expect(
      parseGoalInput({ name: "A", targetAmount: "1", source: "netWorth", savedAmount: "5" }, ["a1"], today),
    ).toMatchObject({ source: "netWorth", accountIds: [], savedAmount: null });
  });

  it("błędy z polem, którego dotyczą", () => {
    expect(code({ name: "", targetAmount: "1" })).toBe("name:name");
    expect(code({ name: "x".repeat(81), targetAmount: "1" })).toBe("name:name");
    expect(code({ name: "A", targetAmount: "0" })).toBe("targetAmount:target");
    expect(code({ name: "A", targetAmount: "abc" })).toBe("targetAmount:target");
    expect(code({ name: "A", targetAmount: "1", targetDate: "3.11.2029" })).toBe("targetDate:date");
    expect(code({ name: "A", targetAmount: "1", targetDate: today })).toBe("targetDate:datePast");
    expect(code({ name: "A", targetAmount: "1", savedAmount: "-5" })).toBe("savedAmount:saved");
    expect(code({ name: "A", targetAmount: "1", source: "accounts" })).toBe("accountIds:accounts");
  });
});
