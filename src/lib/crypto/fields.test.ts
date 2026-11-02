import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptField, encryptField, parseKey } from "./fields";

const k = randomBytes(32);

describe("szyfrowanie pól", () => {
  it("odszyfrowuje to, co zaszyfrowało, z polskimi znakami", () => {
    const secret = "Konto w banku, nr PL61 1090 1014 0000 0712 1981 2874 — notatka żółć";
    expect(decryptField(encryptField(secret, k), k)).toBe(secret);
  });

  it("ten sam tekst daje inny szyfrogram (losowe IV)", () => {
    expect(encryptField("abc", k)).not.toBe(encryptField("abc", k));
  });

  it("wykrywa zmianę szyfrogramu i zły klucz", () => {
    const payload = encryptField("abc", k);
    const parts = payload.split(":");
    parts[3] = Buffer.from("xyz").toString("base64url");
    expect(() => decryptField(parts.join(":"), k)).toThrow();
    expect(() => decryptField(payload, randomBytes(32))).toThrow();
  });

  it("klucz: produkcja wymaga klucza, zła długość jest błędem", () => {
    expect(() => parseKey(undefined, "production")).toThrow(/FIELD_ENCRYPTION_KEY/);
    expect(() => parseKey(Buffer.alloc(16).toString("base64"), "development")).toThrow(/32 bajty/);
    expect(parseKey(undefined, "test")).toHaveLength(32);
  });
});
