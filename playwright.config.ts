import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
// Lokalnie można użyć zainstalowanej przeglądarki: PW_CHANNEL=msedge (Windows) albo chrome.
// W CI: npx playwright install --with-deps chromium.
const channel = process.env.PW_CHANNEL || undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
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
    // Testy na zbudowanej aplikacji (najpierw `next build`); baza tylko lokalna/testowa.
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
