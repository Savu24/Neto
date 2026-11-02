import { expect, test, type Page } from "@playwright/test";

/** Przykład z makiety Cele: 34 lata, emerytura w 60, wynik 63 / 55 / 51 lat. */
async function fillMockupExample(page: Page) {
  await page.getByLabel("Wiek obecny").fill("34");
  await page.getByLabel("Planowany wiek emerytalny").fill("60");
  await page.getByLabel("Majątek startowy").fill("422 870");
  await page.getByLabel("Wpłata miesięczna").fill("3500");
  await page.getByLabel("Wydatki miesięczne na emeryturze").fill("9000");
  await page.getByLabel("Spodziewana emerytura z ZUS").fill("2500");
}

const card = (page: Page, key: "low" | "base" | "high") => page.locator(`[data-scenario="${key}"]`);

test.describe("kalkulator emerytury", () => {
  test("link z ekranu Cele prowadzi do kalkulatora", async ({ page }) => {
    await page.goto("/goals");
    await page.getByRole("link", { name: "Otwórz kalkulator emerytury" }).click();
    await expect(page).toHaveURL(/\/goals\/retirement$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Kiedy mogę przejść na emeryturę" }),
    ).toBeVisible();
  });

  test("domyślne założenia z SPEC i prośba o wiek", async ({ page }) => {
    await page.goto("/goals/retirement");
    await expect(page.getByLabel("Planowany wiek emerytalny")).toHaveValue("65");
    await expect(page.getByLabel("Stopa wypłaty")).toHaveValue("4");
    await expect(page.getByLabel("Realna stopa zwrotu: bazowa")).toHaveValue("3");
    await expect(page.getByRole("status")).toContainText("Wpisz wiek obecny");
  });

  test("zmiana założenia zmienia wynik", async ({ page }) => {
    await page.goto("/goals/retirement");
    await fillMockupExample(page);
    await expect(page.getByText("1 950 000 zł", { exact: true })).toBeVisible();
    await expect(card(page, "low")).toContainText("63 lata");
    await expect(card(page, "base")).toContainText("55 lat");
    await expect(card(page, "high")).toContainText("51 lat");
    await expect(page.getByRole("img", { name: /Kapitał w trzech scenariuszach/ })).toBeVisible();

    await page.getByLabel("Wpłata miesięczna").fill("6000");
    await expect(card(page, "base")).not.toContainText("55 lat");
    await expect(card(page, "base")).toContainText("49 lat");

    await page.getByLabel("Spodziewana emerytura z ZUS").fill("9000");
    await expect(page.getByText(/potrzebny kapitał to 0 zł/)).toBeVisible();
    await expect(card(page, "low")).toContainText("34 lata");

    await page.getByLabel("Wiek obecny").fill("abc");
    await expect(page.getByText("Wpisz liczbę.")).toBeVisible();
    await expect(page.getByLabel("Wiek obecny")).toHaveAttribute("aria-invalid", "true");
  });

  test("tabela alternatywna dla wykresu", async ({ page }) => {
    await page.goto("/goals/retirement");
    await fillMockupExample(page);
    await page.getByText("Pokaż dane wykresu w tabeli").click();
    const table = page.getByRole("table");
    await expect(table).toContainText("Potrzebny kapitał: 1 950 000 zł");
    await expect(table.getByRole("row")).toHaveCount(1 + (80 - 34 + 1));
  });

  test("stałe dopiski są widoczne", async ({ page }) => {
    await page.goto("/goals/retirement");
    const notes = page.getByRole("note");
    await expect(notes.filter({ hasText: "To symulacja, nie gwarancja wyniku." })).toBeVisible();
    await expect(notes.filter({ hasText: "Dane mają charakter informacyjny" })).toBeVisible();
  });

  test("brak poziomego przewijania przy 390 px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/goals/retirement");
    await fillMockupExample(page);
    await page.getByText("Pokaż dane wykresu w tabeli").click();
    await expect(card(page, "base")).toContainText("55 lat");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
