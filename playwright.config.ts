import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
// Lokalnie można użyć zainstalowanej przeglądarki: PW_CHANNEL=msedge (Windows) albo chrome.
// W CI: npx playwright install --with-deps chromium.
const channel = process.env.PW_CHANNEL || undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Jeden serwer next start i jedna baza: więcej workerów tylko kolejkuje żądania (argon2id jest kosztowny celowo).
  workers: 2,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  // Rejestracja i logowanie (argon2id) przy kilku równoległych testach potrafią trwać kilka sekund.
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    locale: "pl-PL",
    timezoneId: "Europe/Warsaw",
  },
  projects: [
    { name: "telefon", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium", channel } },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, channel },
    },
  ],
  webServer: {
    // Testy na zbudowanej aplikacji (najpierw `next build`) z tymczasową bazą (scripts/e2e-server.ts).
    command: `npx tsx scripts/e2e-server.ts`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
