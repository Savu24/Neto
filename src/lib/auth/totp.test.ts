import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateTotpSecret, hotp, otpauthUri, totp, verifyTotp } from "./totp";

// RFC 6238, dodatek B: klucz ASCII "12345678901234567890", SHA1, 8 cyfr.
const rfcSecret = Buffer.from("12345678901234567890");
const vectors: [number, string][] = [
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
  [20000000000, "65353130"],
];

describe("TOTP", () => {
  it("zgadza się z wektorami testowymi RFC 6238", () => {
    for (const [t, code] of vectors) expect(hotp(rfcSecret, Math.floor(t / 30), 8)).toBe(code);
  });

  it("base32 w obie strony", () => {
    const buf = Buffer.from("12345678901234567890");
    expect(base32Encode(buf)).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(base32Decode("gezd gnbv gy3t qojq gezd gnbv gy3t qojq")).toEqual(buf);
  });

  it("weryfikuje bieżący i sąsiedni krok, odrzuca dalsze i śmieci", () => {
    const secret = generateTotpSecret();
    const now = 1_762_000_000_000;
    expect(verifyTotp(secret, totp(secret, now), now)).not.toBeNull();
    expect(verifyTotp(secret, totp(secret, now - 30_000), now)).not.toBeNull();
    expect(verifyTotp(secret, totp(secret, now - 90_000), now)).toBeNull();
    expect(verifyTotp(secret, "12345", now)).toBeNull();
    expect(verifyTotp(secret, "abcdef", now)).toBeNull();
  });

  it("buduje adres otpauth dla aplikacji uwierzytelniającej", () => {
    expect(otpauthUri("ABC", "kasia@example.com")).toBe(
      "otpauth://totp/Neto%3Akasia%40example.com?secret=ABC&issuer=Neto&algorithm=SHA1&digits=6&period=30",
    );
  });
});
