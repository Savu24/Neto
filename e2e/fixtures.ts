import { test as base, expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const PASSWORD = "e2e-bardzo-dlugie-haslo";
const MAIL_DIR = path.resolve("test-results/mail");

export function uniqueEmail(prefix = "e2e") {
  return `${prefix}-${randomBytes(5).toString("hex")}@example.com`;
}

/** Ostatni e-mail do adresata z katalogu testowej skrzynki (MAIL_OUTBOX_DIR serwera e2e). */
export async function readMail(to: string, subjectPart?: string): Promise<{ subject: string; text: string }> {
  for (let i = 0; i < 40; i++) {
    try {
      const files = readdirSync(MAIL_DIR)
        .filter((f) => f.endsWith(`-${to}.json`))
        .sort()
        .reverse();
      for (const f of files) {
        const mail = JSON.parse(readFileSync(path.join(MAIL_DIR, f), "utf8"));
        if (!subjectPart || mail.subject.includes(subjectPart)) return mail;
      }
    } catch {
      // katalog jeszcze nie istnieje
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Brak e-maila do ${to}`);
}

export function linkFrom(text: string): string {
  const m = text.match(/https?:\/\/\S+/);
  if (!m) throw new Error("Brak linku w e-mailu");
  const u = new URL(m[0]);
  return u.pathname + u.search;
}

export async function register(page: Page, email = uniqueEmail()) {
  await page.goto("/register");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Hasło", { exact: true }).fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Załóż konto" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return email;
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Hasło", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Zaloguj się" }).click();
}

/**
 * Każdy test z innego „adresu IP” (nagłówek x-forwarded-for), żeby limity prób rejestracji
 * i logowania nie blokowały równoległych testów.
 */
export const test = base.extend<{ authedPage: Page; email: string }>({
  context: async ({ context }, provide) => {
    await context.setExtraHTTPHeaders({ "x-forwarded-for": [10, ...randomBytes(3)].join(".") });
    await provide(context);
  },
  email: async ({}, provide) => {
    await provide(uniqueEmail());
  },
  authedPage: async ({ page, email }, provide) => {
    await register(page, email);
    await provide(page);
  },
});

export { expect };
