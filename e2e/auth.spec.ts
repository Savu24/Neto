import { totp } from "../src/lib/auth/totp";
import { PASSWORD, expect, linkFrom, login, readMail, register, test } from "./fixtures";

test.describe("logowanie i konto", () => {
  test("bez sesji chronione strony przekierowują do logowania z powrotem", async ({ page }) => {
    await page.goto("/assets?x=1");
    await expect(page).toHaveURL(/\/login\?next=%2Fassets%3Fx%3D1$/);
  });

  test("rejestracja, wylogowanie, złe hasło, logowanie z powrotem na stronę", async ({ page, email }) => {
    await register(page, email);
    await page.goto("/settings");
    await expect(page.getByText(email)).toBeVisible();
    await page.getByRole("button", { name: "Wyloguj", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Wylogowano");

    await login(page, email, "zle-haslo-calkiem-dlugie");
    await expect(page.getByRole("alert").filter({ hasText: "Nieprawidłowy e-mail lub hasło" })).toBeVisible();

    await page.goto("/goals");
    await expect(page).toHaveURL(/\/login\?next=%2Fgoals/);
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Hasło", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Zaloguj się" }).click();
    await expect(page).toHaveURL(/\/goals$/);
  });

  test("potwierdzenie e-maila linkiem z wiadomości (przyciskiem, nie samym wejściem)", async ({
    page,
    email,
  }) => {
    await register(page, email);
    const mail = await readMail(email, "Potwierdź");
    await page.goto(linkFrom(mail.text));
    await page.getByRole("button", { name: "Potwierdź" }).click();
    await expect(page.getByRole("status")).toContainText("potwierdzony");
    await page.goto("/settings/security");
    await expect(page.getByText(`${email}: Potwierdzony`)).toBeVisible();
  });

  test("reset hasła przez e-mail i logowanie nowym hasłem", async ({ page, email }) => {
    await register(page, email);
    await page.goto("/settings");
    await page.getByRole("button", { name: "Wyloguj", exact: true }).click();

    await page.goto("/forgot-password");
    await page.getByLabel("E-mail").fill(email);
    await page.getByRole("button", { name: "Wyślij link" }).click();
    await expect(page.getByRole("status")).toContainText("wysłaliśmy");
    const mail = await readMail(email, "nowe hasło");
    await page.goto(linkFrom(mail.text));
    await page.getByLabel("Nowe hasło").fill("zupelnie-nowe-haslo-123");
    await page.getByRole("button", { name: "Zapisz nowe hasło" }).click();
    await expect(page.getByRole("status")).toContainText("Hasło zmienione");
    await login(page, email, "zupelnie-nowe-haslo-123");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("weryfikacja dwuetapowa: włączenie, kody zapasowe, logowanie z kodem", async ({
    authedPage: page,
    email,
  }) => {
    await page.goto("/settings/security");
    await page.getByRole("button", { name: "Włącz" }).click();
    const secret = (await page.getByTestId("totp-secret").textContent())!.trim();
    await page.getByLabel("Potwierdź kod").fill(totp(secret));
    await page.getByRole("button", { name: "Potwierdź kod" }).click();
    const codes = page.getByRole("list", { name: "Kody zapasowe" }).getByRole("listitem");
    await expect(codes).toHaveCount(10);
    await page.getByRole("button", { name: "Zapisane, zamknij" }).click();
    await expect(page.getByText("Włączona")).toBeVisible();
    await expect(page.getByText("10 z 10 niewykorzystanych")).toBeVisible();
    await expect(await readMail(email, "dwuetapowa włączona")).toBeTruthy();

    await page.goto("/settings");
    await page.getByRole("button", { name: "Wyloguj", exact: true }).click();
    await login(page, email);
    await expect(page).toHaveURL(/\/login\/2fa/);
    // bez kodu dane są niedostępne
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\/2fa/);
    await page.getByLabel("Kod").fill("000000");
    await page.getByRole("button", { name: "Potwierdź" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Kod jest nieprawidłowy" })).toBeVisible();
    await page.getByLabel("Kod").fill(totp(secret));
    await page.getByRole("button", { name: "Potwierdź" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("sesje: lista urządzeń i wylogowanie wszystkich", async ({ browser, email }) => {
    const a = await browser.newPage();
    await register(a, email);
    const b = await browser.newPage();
    await login(b, email);
    await expect(b).toHaveURL(/\/dashboard$/);

    await a.goto("/settings/security");
    await expect(a.getByText("to urządzenie")).toBeVisible();
    await a.getByRole("button", { name: "Wyloguj ze wszystkich urządzeń" }).click();
    // przycisk znika, gdy zostaje tylko bieżąca sesja (akcja zakończona)
    await expect(a.getByRole("button", { name: "Wyloguj ze wszystkich urządzeń" })).toHaveCount(0);
    await b.goto("/dashboard");
    await expect(b).toHaveURL(/\/login/);
    await a.goto("/dashboard");
    await expect(a).toHaveURL(/\/dashboard$/);
  });

  test("eksport danych: ZIP dla zalogowanego, 401 bez sesji", async ({
    authedPage: page,
    playwright,
    baseURL,
  }) => {
    const res = await page.request.get("/api/export");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/zip");
    expect((await res.body()).subarray(0, 2).toString()).toBe("PK");
    const anon = await playwright.request.newContext({ baseURL });
    expect((await anon.get("/api/export")).status()).toBe(401);
  });

  test("usunięcie konta: wylogowanie, a logowanie w karencji anuluje usunięcie", async ({
    authedPage: page,
    email,
  }) => {
    await page.goto("/settings/data");
    await page.getByLabel("Hasło lub kod z aplikacji uwierzytelniającej").fill("zle-haslo");
    await page.getByRole("button", { name: "Usuń konto" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Nieprawidłowy" })).toBeVisible();
    await page.getByLabel("Hasło lub kod z aplikacji uwierzytelniającej").fill(PASSWORD);
    await page.getByRole("button", { name: "Usuń konto" }).click();
    await expect(page).toHaveURL(/\/login\?notice=signed-out/);
    await expect(await readMail(email, "zostanie usunięte")).toBeTruthy();

    await login(page, email);
    await expect(page).toHaveURL(/\/dashboard\?notice=deletion-cancelled/);
    await expect(await readMail(email, "anulowane")).toBeTruthy();
  });
});
