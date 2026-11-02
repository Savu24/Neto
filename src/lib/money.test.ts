import { describe, expect, it } from "vitest";
import { D, sum, toMoneyString, toQuantityString } from "./money";

describe("money", () => {
  it("nie ma błędów zmiennoprzecinkowych", () => {
    expect(D("0.1").plus("0.2").toString()).toBe("0.3");
    expect(sum(["18469.98", "52300", "10212.18", "3187.84"]).toString()).toBe("84170");
  });

  it("zaokrągla kwoty połówkowo w górę", () => {
    expect(toMoneyString("148208.965")).toBe("148208.97");
    expect(toMoneyString("-3804.185")).toBe("-3804.19");
    expect(toMoneyString(10)).toBe("10.00");
  });

  it("zapis wartości pozycji w obcej walucie z przykładu w makiecie", () => {
    const valueEur = D(262).times("132.64");
    expect(valueEur.toString()).toBe("34751.68");
    expect(toMoneyString(valueEur.times("4.2648"))).toBe("148208.96");
  });

  it("ilości do 10 miejsc", () => {
    expect(toQuantityString("0.071234567891")).toBe("0.0712345679");
  });
});
