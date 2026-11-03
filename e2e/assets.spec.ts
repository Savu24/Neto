import type { Page, TestInfo } from "@playwright/test";
import path from "node:path";
import { expect, register, test, uniqueEmail } from "./fixtures";

/**
 * Etap 5: konta, transakcje, import CSV (HU-2.1–2.8). Wartości z zestawu referencyjnego
 * docs/referencje/majatek.md. Zrzuty „po” do docs/zrzuty/etap-5: ZRZUTY=1 npx playwright test e2e/assets.spec.ts
 */

const SAMPLE = path.resolve("e2e/data/wyciag-przyklad.csv");

async function shot(page: Page, info: TestInfo, name: string) {
  if (!process.env.ZRZUTY) return;
  const device = info.project.name === "desktop" ? "desktop" : "telefon";
  await page.screenshot({ path: `docs/zrzuty/etap-5/po-${name}-${device}.png`, fullPage: true });
}

async function addAccount(
  page: Page,
  type: string,
  name: string,
  fill: (page: Page) => Promise<void> = async () => {},
) {
  await page.goto("/add/account");
  await page.getByRole("radio", { name: type, exact: true }).check();
  await page.getByLabel("Nazwa").fill(name);
  await fill(page);
  await page.getByRole("button", { name: "Dodaj konto" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return page.url().split("/assets/")[1];
}

async function importSample(page: Page) {
  await page.getByRole("link", { name: "Importuj CSV" }).click();
  await page.getByLabel("Plik CSV").setInputFiles(SAMPLE);
  await page.getByRole("button", { name: "Dalej" }).click();
  await expect(page.getByText(/Wykryto: kodowanie UTF-8, separator średnik, wierszy: 3/)).toBeVisible();
  await page.getByRole("button", { name: "Pokaż podgląd" }).click();
}

test.describe("majątek: konta, transakcje, import", () => {
  test("zestaw referencyjny: konto, import CSV, kupno, sprzedaż, wartości", async ({
    authedPage: page,
  }, info) => {
    test.setTimeout(120_000);
    await page.goto("/assets");
    await expect(page.getByRole("heading", { name: "Nie masz jeszcze żadnych kont" })).toBeVisible();
    await shot(page, info, "majatek-pusty");

    // Konto osobiste z saldem startowym
    await page.goto("/add");
    await shot(page, info, "dodaj");
    await addAccount(page, "Rachunek", "Konto osobiste", async (p) => {
      await p.getByLabel("Saldo").fill("10 000,00");
      await p.getByLabel("Na dzień").fill("2026-10-01");
    });
    await expect(page.getByTestId("account-value")).toHaveText("10 000,00 zł");

    // Import przykładowego CSV: plik → mapowanie → podgląd → import
    await importSample(page);
    await expect(page.getByRole("status").filter({ hasText: "Wierszy:" })).toHaveText(
      "Wierszy: 3. Do importu: 3. Duplikaty: 0. Błędy: 0.",
    );
    await shot(page, info, "import-podglad");
    await page.getByRole("button", { name: "Importuj (3)" }).click();
    await expect(page.getByText("Zaimportowano transakcji: 3. Pominięto: 0.")).toBeVisible();
    await page.getByRole("link", { name: "Przejdź do konta" }).click();
    await expect(page.getByTestId("account-value")).toHaveText("15 837,50 zł");
    await expect(page.getByText('Kawa "Pod Lipą"', { exact: false })).toBeVisible();

    // Ten sam plik drugi raz: same duplikaty
    await importSample(page);
    await expect(page.getByRole("status").filter({ hasText: "Wierszy:" })).toHaveText(
      "Wierszy: 3. Do importu: 0. Duplikaty: 3. Błędy: 0.",
    );
    await expect(page.getByRole("button", { name: "Brak wierszy do zaimportowania" })).toBeDisabled();

    // IKE: instrument ręczny z ceną, kupno i sprzedaż
    const ikeId = await addAccount(page, "Konto maklerskie", "IKE", async (p) => {
      await p.getByLabel("Opakowanie podatkowe").selectOption("IKE");
    });
    await page.getByRole("link", { name: "Dodaj transakcję" }).click();
    await expect(page.getByLabel("Konto", { exact: true })).toHaveValue(ikeId);
    await expect(page.getByLabel("Rodzaj")).toHaveValue("BUY");
    await page.getByLabel("Szukaj instrumentu").fill("ETF testowy");
    await expect(page.getByText("Nic nie znaleziono.")).toBeVisible();
    await page.getByRole("button", { name: "Dodaj instrument ręcznie" }).click();
    await page.getByLabel("Nazwa instrumentu").fill("ETF testowy");
    await page.getByLabel("Ticker (opcjonalnie)").fill("ETFT");
    await page.getByLabel("Cena bieżąca (opcjonalnie)").fill("120");
    await page.getByRole("button", { name: "Dodaj instrument", exact: true }).click();
    await expect(page.getByText("Wybrany: ETF testowy (ETFT)")).toBeVisible();
    await page.getByLabel("Liczba sztuk").fill("10");
    await page.getByLabel(/Cena za sztukę/).fill("100");
    await page.getByLabel("Prowizja (opcjonalnie)").fill("5");
    await page.getByLabel("Data").fill("2026-10-10");
    await shot(page, info, "transakcja");
    await page.getByRole("button", { name: "Zapisz transakcję" }).click();
    await expect(page).toHaveURL(new RegExp(`/assets/${ikeId}$`));
    await expect(page.getByTestId("account-value")).toHaveText("1200,00 zł");

    await page.getByRole("link", { name: "Dodaj transakcję" }).click();
    await page.getByLabel("Rodzaj").selectOption("SELL");
    await page.getByLabel("Instrument").selectOption({ label: "ETFT: ETF testowy (10)" });
    await page.getByLabel("Liczba sztuk").fill("4");
    await page.getByLabel(/Cena za sztukę/).fill("110");
    await page.getByLabel("Prowizja (opcjonalnie)").fill("3");
    await page.getByLabel("Data").fill("2026-10-20");
    await page.getByRole("button", { name: "Zapisz transakcję" }).click();
    await expect(page.getByTestId("account-value")).toHaveText("1157,00 zł");

    // Sprzedaż ponad stan: czytelny błąd z dostępną ilością, wpisane dane zostają
    await page.getByRole("link", { name: "Dodaj transakcję" }).click();
    await page.getByLabel("Rodzaj").selectOption("SELL");
    await page.getByLabel("Instrument").selectOption({ label: "ETFT: ETF testowy (6)" });
    await page.getByLabel("Liczba sztuk").fill("10");
    await page.getByLabel(/Cena za sztukę/).fill("110");
    await page.getByRole("button", { name: "Zapisz transakcję" }).click();
    const error = page.getByRole("alert").filter({ hasText: "Nie możesz sprzedać 10 szt." });
    await expect(error).toContainText("masz 6 szt.");
    await expect(page.getByLabel("Liczba sztuk")).toHaveValue("10");

    // Szczegóły pozycji: wynik FIFO
    await page.goto(`/assets/${ikeId}`);
    await shot(page, info, "konto-ike");
    await page.getByRole("link", { name: "ETF testowy" }).first().click();
    await expect(page.getByTestId("position-value")).toHaveText("720,00 zł");
    await expect(page.getByTestId("position-result")).toContainText("+117,00 zł");
    await expect(page.getByTestId("position-result")).toContainText("+19,4%");
    await expect(page.getByText("603,00 zł").first()).toBeVisible();
    await expect(page.getByText("+35,00 zł").first()).toBeVisible();
    await expect(page.getByRole("note")).toContainText("nie stanowi");
    await shot(page, info, "pozycja");

    // Majątek: wartość netto z zestawu referencyjnego, przełącznik konta/klasy
    await page.goto("/assets");
    await expect(page.getByTestId("net-worth")).toContainText("16 994,50 zł");
    await expect(page.getByRole("heading", { name: "Gotówka i konta" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Inwestycje" })).toBeVisible();
    await expect(page.getByRole("note")).toContainText("nie stanowi");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);
    await shot(page, info, "majatek");
    await page.getByRole("link", { name: "Klasy aktywów" }).click();
    await expect(page.getByRole("heading", { name: "ETF-y" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Gotówka" })).toBeVisible();
    await shot(page, info, "majatek-klasy");
  });

  test("katalog instrumentów, brak wyceny, archiwizacja", async ({ authedPage: page }) => {
    await addAccount(page, "Konto maklerskie", "Maklerskie");
    await page.getByRole("link", { name: "Dodaj transakcję" }).click();
    await page.getByLabel("Szukaj instrumentu").fill("pko");
    await page.getByRole("button", { name: /PKO Bank Polski/ }).click();
    await expect(page.getByText("Wybrany: PKO Bank Polski (PKO)")).toBeVisible();
    await page.getByLabel("Liczba sztuk").fill("2");
    await page.getByLabel(/Cena za sztukę/).fill("50");
    await page.getByRole("button", { name: "Zapisz transakcję" }).click();
    // brak notowania: wartość z ceny transakcji z oznaczeniem, nie zero
    await expect(page.getByTestId("account-value")).toHaveText("100,00 zł");
    await expect(page.getByText("brak wyceny, cena z transakcji").first()).toBeVisible();

    await page.getByRole("button", { name: "Archiwizuj" }).click();
    await expect(page).toHaveURL(/\/assets$/);
    await expect(page.getByRole("heading", { name: "Nie masz jeszcze żadnych kont" })).toBeVisible();
    await page.getByRole("link", { name: "Pokaż zarchiwizowane (1)" }).click();
    await expect(page.getByRole("link", { name: "Maklerskie" })).toBeVisible();
  });

  test("lokata, kredyt i aktualizacja salda", async ({ authedPage: page }) => {
    const checkingId = await addAccount(page, "Rachunek", "Rachunek bieżący");
    await addAccount(page, "Lokata", "Lokata 6 mies.", async (p) => {
      await p.getByLabel("Kwota lokaty").fill("10000");
      await p.getByLabel("Oprocentowanie roczne (%)").fill("5,1");
      await p.getByLabel("Data założenia").fill("2026-06-03");
      await p.getByLabel("Okres (miesiące)").fill("6");
      await p.getByLabel("Konto wypłaty po terminie (opcjonalnie)").selectOption(checkingId);
    });
    await expect(
      page.getByText("Wartość z naliczonymi odsetkami (szacunek, przed podatkiem 19%)."),
    ).toBeVisible();
    const loanId = await addAccount(page, "Kredyt hipoteczny", "Hipoteka", async (p) => {
      await p.getByLabel("Saldo do spłaty").fill("300 000");
      await p.getByLabel("Rata miesięczna (opcjonalnie)").fill("2 500");
    });
    await expect(page.getByTestId("account-value")).toHaveText("−300 000,00 zł");
    await page.getByRole("textbox", { name: "Saldo do spłaty" }).fill("298 000");
    await page.getByRole("button", { name: "Zaktualizuj" }).click();
    await expect(page).toHaveURL(new RegExp(`/assets/${loanId}$`));
    await expect(page.getByTestId("account-value")).toHaveText("−298 000,00 zł");
    await page.goto("/assets");
    await expect(page.getByRole("heading", { name: "Zobowiązania" })).toBeVisible();
    await expect(page.getByText("−298 000,00 zł").first()).toBeVisible();
  });

  test("izolacja: cudze konto daje 404", async ({ authedPage: page, browser }) => {
    const id = await addAccount(page, "Gotówka", "Portfel");
    const other = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "10.9.9.9" } });
    const p2 = await other.newPage();
    await register(p2, uniqueEmail("obcy"));
    for (const path of [`/assets/${id}`, `/assets/${id}/edit`]) {
      const res = await p2.goto(path);
      expect(res?.status(), path).toBe(404);
    }
    await p2.goto(`/add/transaction?account=${id}`);
    await expect(p2.getByText("Najpierw dodaj konto.")).toBeVisible();
    await other.close();
  });
});
