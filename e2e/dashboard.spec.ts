import { expect, test } from "./fixtures";

test.describe("pulpit", () => {
  test("pusty pulpit zaprasza do dodania konta", async ({ authedPage: page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Zacznij od pierwszego konta" })).toBeVisible();
    await expect(page.getByRole("note")).toContainText("nie stanowi");
  });

  test("wartość netto, historia, alokacja, cel główny i największe pozycje", async ({ authedPage: page }) => {
    await page.goto("/add/account");
    await page.getByRole("radio", { name: "Rachunek", exact: true }).check();
    await page.getByLabel("Nazwa").fill("Konto osobiste");
    await page.getByLabel("Saldo").fill("10 000,00");
    await page.getByLabel("Na dzień").fill("2026-01-15");
    await page.getByRole("button", { name: "Dodaj konto" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Konto osobiste" })).toBeVisible();

    await page.goto("/goals/new");
    await page.getByLabel("Nazwa celu").fill("Poduszka");
    await page.getByLabel("Kwota celu (zł)").fill("20 000");
    await page.getByRole("radio", { name: "Z całej wartości netto" }).check();
    await page.getByLabel("Cel główny (pokazuje się pierwszy)").check();
    await page.getByRole("button", { name: "Utwórz cel" }).click();
    await expect(page).toHaveURL(/\/goals$/);

    await page.goto("/dashboard");
    await expect(page.getByTestId("dashboard-net-worth")).toHaveText(/^10\s000,00\s*zł$/);
    await expect(page.getByRole("img", { name: /Wykres wartości netto/ })).toBeVisible();
    const goal = page.getByTestId("dashboard-goal");
    await expect(goal).toContainText("Poduszka");
    await expect(goal).toContainText("50%");
    await expect(page.getByRole("region", { name: "Alokacja" })).toContainText("Gotówka");
    await expect(page.getByRole("region", { name: "Największe pozycje" })).toContainText("Konto osobiste");
    await expect(page.getByRole("note")).toContainText("nie stanowi");
    // Bez poziomego przewijania (na telefonie ukryta tabela wykresu potrafiła rozepchnąć stronę).
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);

    await page.getByRole("link", { name: "Wszystko" }).click();
    await expect(page).toHaveURL(/range=all/);
    await expect(page.getByRole("link", { name: "Wszystko" })).toHaveAttribute("aria-current", "page");
    await page.getByRole("link", { name: "Waluta" }).click();
    await expect(page.getByRole("region", { name: "Alokacja" })).toContainText("PLN");
  });
});

test("kalkulator emerytury zapisuje założenia i bierze majątek z kont", async ({ authedPage: page }) => {
  await page.goto("/goals/retirement");
  await expect(page.getByLabel("Majątek startowy")).toHaveValue("0");
  await page.getByLabel("Wiek obecny").fill("34");
  await page.getByLabel("Wydatki miesięczne na emeryturze").fill("9000");
  await page.getByLabel("Planowany wiek emerytalny").fill("60");
  await page.getByRole("button", { name: "Zapisz założenia" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Założenia zapisane" })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Wiek obecny")).toHaveValue("34");
  await expect(page.getByLabel("Planowany wiek emerytalny")).toHaveValue("60");
  await expect(page.getByLabel("Wydatki miesięczne na emeryturze")).toHaveValue("9000");
});

test("szybka wpłata i wypłata z pulpitu", async ({ authedPage: page }) => {
  await page.goto("/add/account");
  await page.getByRole("radio", { name: "Rachunek", exact: true }).check();
  await page.getByLabel("Nazwa").fill("Konto główne");
  await page.getByLabel("Saldo").fill("1 000,00");
  await page.getByRole("button", { name: "Dodaj konto" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Konto główne" })).toBeVisible();

  await page.goto("/dashboard");
  const quick = page.getByRole("group", { name: "Szybka wpłata lub wypłata" });
  await quick.getByRole("button", { name: "Wpłata", exact: true }).click();
  await quick.getByLabel("Kwota").fill("500");
  await quick.getByRole("button", { name: "Zapisz wpłatę" }).click();
  await expect(quick.getByRole("status")).toHaveText("Wpłata zapisana.");
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByTestId("dashboard-net-worth")).toHaveText(/^1500,00\s*zł$/);

  await quick.getByRole("button", { name: "Wypłata", exact: true }).click();
  await quick.getByLabel("Kwota").fill("200");
  await quick.getByRole("button", { name: "Zapisz wypłatę" }).click();
  await expect(quick.getByRole("status")).toHaveText("Wypłata zapisana.");
  await expect(page.getByTestId("dashboard-net-worth")).toHaveText(/^1300,00\s*zł$/);
});
