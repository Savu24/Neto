import type { Page, TestInfo } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * Etap 9: powiadomienia (HU-6.1–6.3). Wpisy tworzy cron, który test woła sam (testowy CRON_SECRET
 * z scripts/e2e-server.ts). Zrzuty do docs/zrzuty/etap-9: ZRZUTY=1 npx playwright test e2e/notifications.spec.ts
 */

const CRON = { Authorization: "Bearer e2e-cron-secret" };

async function shot(page: Page, info: TestInfo, name: string) {
  if (!process.env.ZRZUTY) return;
  const device = info.project.name === "desktop" ? "desktop" : "telefon";
  await page.screenshot({ path: `docs/zrzuty/etap-9/${name}-${device}.png`, fullPage: true });
}

/** Cel „od zera” z odłożoną całą kwotą: plan „osiągnięty”. */
async function reachedGoal(page: Page, name: string) {
  await page.goto("/goals/new");
  await page.getByLabel("Nazwa celu").fill(name);
  await page.getByLabel("Kwota celu (zł)").fill("1000");
  await page.getByLabel("Już odłożone (zł)").fill("1000");
  await page.getByRole("button", { name: "Utwórz cel" }).click();
  await expect(page).toHaveURL(/\/goals$/);
}

async function runCron(page: Page) {
  const res = await page.request.get("/api/cron/notifications", { headers: CRON });
  expect(res.status()).toBe(200);
}

test.describe("powiadomienia", () => {
  test("cron bez sekretu dostaje 401", async ({ request }) => {
    const res = await request.get("/api/cron/notifications");
    expect(res.status()).toBe(401);
  });

  test("osiągnięty cel: wpis po cronie, licznik w Ustawieniach, oznaczanie jako przeczytane", async ({
    authedPage: page,
  }, info) => {
    await page.goto("/notifications");
    await expect(page.getByRole("heading", { name: "Nie masz jeszcze powiadomień" })).toBeVisible();
    await shot(page, info, "powiadomienia-pusto");

    await reachedGoal(page, "Poduszka");
    await reachedGoal(page, "Wakacje");
    await runCron(page);
    await runCron(page); // drugi przebieg niczego nie dubluje

    await page.goto("/settings");
    await expect(page.getByTestId("unread-count")).toHaveText("Nowe: 2");
    await shot(page, info, "ustawienia");
    await page.getByRole("link", { name: /^Powiadomienia/ }).click();
    await expect(page).toHaveURL(/\/notifications$/);

    const items = page.getByTestId("notification");
    await expect(items).toHaveCount(2);
    await expect(page.getByRole("heading", { name: /Osiągnięto cel: Poduszka/ })).toBeVisible();
    await expect(page.getByText("Nowe: 2")).toBeVisible();
    await expect(page.getByRole("note")).toContainText("nie stanowią porady inwestycyjnej");
    await shot(page, info, "powiadomienia");

    await page.getByRole("button", { name: "Oznacz jako przeczytane: Osiągnięto cel: Poduszka" }).click();
    await expect(page.getByText("Nowe: 1")).toBeVisible();
    await page.getByRole("button", { name: "Oznacz wszystkie jako przeczytane" }).click();
    await expect(page.getByText("Wszystko przeczytane")).toBeVisible();
    await expect(page.locator("[data-unread]")).toHaveCount(0);

    await page.goto("/settings");
    await expect(page.getByTestId("unread-count")).toHaveCount(0);
  });

  test("preferencje: wyłączony typ w aplikacji zostaje po zapisie i nie tworzy wpisu", async ({
    authedPage: page,
  }, info) => {
    await page.goto("/settings");
    await page.getByRole("link", { name: /Ustawienia powiadomień/ }).click();
    await expect(page).toHaveURL(/\/settings\/notifications$/);

    const goalInApp = page.getByRole("checkbox", { name: "Osiągnięty cel: W aplikacji" });
    await expect(goalInApp).toBeChecked();
    // Konto z e2e nie ma potwierdzonego adresu: e-mail nieaktywny z wyjaśnieniem.
    await expect(page.getByRole("checkbox", { name: "Osiągnięty cel: E-mail" })).toBeDisabled();
    await expect(page.getByText("Potwierdź adres e-mail")).toBeVisible();
    await shot(page, info, "preferencje");

    await goalInApp.uncheck();
    await page.getByRole("button", { name: "Zapisz" }).click();
    await expect(page.getByText("Zapisano ustawienia powiadomień.")).toBeVisible();
    await page.reload();
    await expect(goalInApp).not.toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Podsumowanie tygodnia: W aplikacji" })).toBeChecked();

    await reachedGoal(page, "Rower");
    await runCron(page);
    await page.goto("/notifications");
    await expect(page.getByRole("heading", { name: "Nie masz jeszcze powiadomień" })).toBeVisible();
  });
});
