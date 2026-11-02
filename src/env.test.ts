import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { featureFlags, parseServerEnv } = await import("./env");

describe("parseServerEnv", () => {
  it("przyjmuje pusty zestaw i ustawia wartości domyślne", () => {
    const env = parseServerEnv({});
    expect(env.NODE_ENV).toBe("development");
    expect(env.APP_URL).toBe("http://localhost:3000");
    expect(env.DATABASE_URL).toBeUndefined();
  });

  it("traktuje pusty napis jak brak wartości", () => {
    expect(parseServerEnv({ AUTH_GOOGLE_ID: "  " }).AUTH_GOOGLE_ID).toBeUndefined();
  });

  it("odrzuca nieprawidłowy adres i nie pokazuje wartości w błędzie", () => {
    expect(() => parseServerEnv({ APP_URL: "nie-adres-tajne" })).toThrow(/APP_URL/);
    expect(() => parseServerEnv({ APP_URL: "nie-adres-tajne" })).not.toThrow(/tajne/);
  });
});

describe("featureFlags", () => {
  it("bez kluczy wszystko jest wyłączone", () => {
    const flags = featureFlags(parseServerEnv({}));
    expect(Object.values(flags).every((v) => v === false)).toBe(true);
  });

  it("logowanie Google wymaga obu kluczy", () => {
    expect(featureFlags(parseServerEnv({ AUTH_GOOGLE_ID: "id" })).googleLogin).toBe(false);
    expect(featureFlags(parseServerEnv({ AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "s" })).googleLogin).toBe(
      true,
    );
  });
});
