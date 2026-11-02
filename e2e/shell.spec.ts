import { expect, test, type Page } from "@playwright/test";

const pages = [
  { path: "/dashboard", heading: "Pulpit" },
  { path: "/assets", heading: "Majątek" },
  { path: "/goals", heading: "Cele" },
  { path: "/settings", heading: "Ustawienia" },
];

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

test.describe("szkielet aplikacji", () => {
  for (const { path, heading } of pages) {
    test(`${path} ładuje się bez poziomego przewijania`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });
  }

  test("ekrany wyników mają stały dopisek informacyjny", async ({ page }) => {
    for (const path of ["/dashboard", "/assets", "/goals"]) {
      await page.goto(path);
      await expect(page.getByRole("note")).toContainText("nie stanowi");
    }
  });

  test("nawigacja prowadzi między ekranami i oznacza bieżący", async ({ page }) => {
    await page.goto("/dashboard");
    const nav = page.getByRole("navigation", { name: "Nawigacja główna" }).locator("visible=true");
    await nav.getByRole("link", { name: "Cele" }).click();
    await expect(page).toHaveURL(/\/goals$/);
    await expect(nav.getByRole("link", { name: "Cele" })).toHaveAttribute("aria-current", "page");
  });

  test("motyw i język zapisują się i działają po przeładowaniu", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: "Ciemny" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "English" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("nieznany adres pokazuje 404 z drogą powrotu", async ({ page }) => {
    const res = await page.goto("/nie-ma-takiej");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("link", { name: "Wróć na pulpit" })).toBeVisible();
  });

  test("nagłówki bezpieczeństwa", async ({ request }) => {
    const res = await request.get("/dashboard");
    expect(res.headers()["x-frame-options"]).toBe("DENY");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["x-powered-by"]).toBeUndefined();
  });
});
