import { expect, test } from "./fixtures";

test.describe("cele", () => {
  test("cel 50 000 zł za 3 lata: podgląd, zapis, wpłata, edycja i usunięcie", async ({
    authedPage: page,
  }) => {
    await page.goto("/goals");
    await page.getByRole("link", { name: "Nowy cel" }).click();
    await expect(page).toHaveURL(/\/goals\/new$/);

    await page.getByLabel("Nazwa celu").fill("Samochód");
    await page.getByLabel("Kwota celu (zł)").fill("50 000");
    await page.getByRole("button", { name: "Za 3 lata" }).click();
    const preview = page.getByRole("region", { name: "Podgląd" });
    // Polski zapis nie grupuje liczb czterocyfrowych: 1388,89 zł, ale 14 000,00 zł.
    await expect(preview.getByTestId("per-month")).toHaveText(/^1388,89\s*zł$/);
    await expect(preview.getByTestId("per-day")).toBeVisible();
    await page.getByRole("button", { name: "Utwórz cel" }).click();

    await expect(page).toHaveURL(/\/goals$/);
    const card = page.getByTestId("goal-card");
    await expect(card.getByRole("heading", { name: "Samochód" })).toBeVisible();
    await expect(card.getByTestId("per-month")).toHaveText(/^1388,89\s*zł$/);
    await expect(page.getByRole("note")).toContainText("nie stanowi");

    await card.getByLabel("Odłożone teraz").fill("14 000");
    await card.getByRole("button", { name: "Dodaj do celu" }).click();
    await expect(card.getByTestId("goal-current")).toHaveText(/14\s000,00\s*zł/);
    await expect(card.getByTestId("per-month")).toHaveText(/^1000,00\s*zł$/);

    await card.getByRole("link", { name: "Edytuj: Samochód" }).click();
    await expect(page.getByLabel("Już odłożone (zł)")).toHaveValue("14000");
    await page.getByLabel("Nazwa celu").fill("Nowy samochód");
    await page.getByRole("button", { name: "Zapisz cel" }).click();
    await expect(page.getByTestId("goal-card").getByRole("heading", { name: "Nowy samochód" })).toBeVisible();

    await page.getByRole("link", { name: "Edytuj: Nowy samochód" }).click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Usuń cel" }).click();
    await expect(page.getByRole("heading", { name: "Ustaw pierwszy cel" })).toBeVisible();
  });

  test("błąd walidacji zostawia wpisane dane", async ({ authedPage: page }) => {
    await page.goto("/goals/new");
    await page.getByLabel("Nazwa celu").fill("Wakacje");
    await page.getByRole("button", { name: "Utwórz cel" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "kwotę celu" })).toBeVisible();
    await expect(page.getByLabel("Nazwa celu")).toHaveValue("Wakacje");
  });
});
