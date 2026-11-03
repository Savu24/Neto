import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const pages = [
  { path: "/dashboard", heading: "Pulpit" },
  { path: "/assets", heading: "Majątek" },
  { path: "/goals", heading: "Cele" },
  { path: "/settings", heading: "Ustawienia" },
  { path: "/settings/security", heading: "Bezpieczeństwo" },
  { path: "/settings/data", heading: "Twoje dane" },
];

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

test.describe("szkielet aplikacji (zalogowany)", () => {
  test("ekrany ładują się bez poziomego przewijania", async ({ authedPage: page }) => {
    for (const { path, heading } of pages) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      expect(await horizontalOverflow(page), path).toBeLessThanOrEqual(0);
    }
  });

  test("ekrany wyników mają stały dopisek informacyjny", async ({ authedPage: page }) => {
    for (const path of ["/dashboard", "/assets", "/goals"]) {
      await page.goto(path);
      await expect(page.getByRole("note")).toContainText("nie stanowi");
    }
  });

  test("nawigacja prowadzi między ekranami i oznacza bieżący", async ({ authedPage: page }) => {
    const nav = page.getByRole("navigation", { name: "Nawigacja główna" }).locator("visible=true");
    await nav.getByRole("link", { name: "Cele" }).click();
    await expect(page).toHaveURL(/\/goals$/);
    await expect(nav.getByRole("link", { name: "Cele" })).toHaveAttribute("aria-current", "page");
  });

  test("język zapisuje się i działa po przeładowaniu; jest tylko jasny motyw", async ({
    authedPage: page,
  }) => {
    await page.goto("/settings");
    await expect(page.getByRole("button", { name: "Ciemny" })).toHaveCount(0);
    await page.getByRole("button", { name: "English" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  });
});

test.describe("strony publiczne i nagłówki", () => {
  test("nieznany adres pokazuje 404 z drogą powrotu", async ({ page }) => {
    const res = await page.goto("/nie-ma-takiej");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("link", { name: "Wróć na pulpit" })).toBeVisible();
  });

  test("nagłówki bezpieczeństwa i CSP z nonce", async ({ request }) => {
    const res = await request.get("/login");
    const h = res.headers();
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-powered-by"]).toBeUndefined();
    expect(h["content-security-policy"]).toMatch(
      /script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/,
    );
    const second = await request.get("/login");
    expect(second.headers()["content-security-policy"]).not.toBe(h["content-security-policy"]);
  });

  test("strona logowania działa bez błędów CSP w konsoli", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" && /Content Security Policy|CSP/i.test(m.text())) violations.push(m.text());
    });
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Zaloguj się do Neto" })).toBeVisible();
    expect(violations).toEqual([]);
  });
});
