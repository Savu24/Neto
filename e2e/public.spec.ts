import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const PUBLIC_PAGES = [
  { path: "/", heading: "Cały majątek w jednej liczbie" },
  { path: "/legal/terms", heading: "Regulamin usługi Neto" },
  { path: "/legal/privacy", heading: "Polityka prywatności Neto" },
  { path: "/legal/cookies", heading: "Polityka cookies Neto" },
  { path: "/legal/risk", heading: "Informacja o ryzyku i braku doradztwa" },
  { path: "/delete-account", heading: "Jak usunąć konto w Neto" },
  { path: "/offline", heading: "Brak połączenia" },
];

const APP_PATHS = [
  "/dashboard",
  "/assets",
  "/goals",
  "/settings",
  "/add",
  "/notifications",
  "/api/",
  "/offline",
];

function collectCspErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy|CSP/i.test(m.text())) errors.push(m.text());
  });
  return errors;
}

test.describe("strony publiczne", () => {
  test("przy 390 px bez poziomego przewijania i bez błędów CSP", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const csp = collectCspErrors(page);
    for (const { path, heading } of PUBLIC_PAGES) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
    expect(csp).toEqual([]);
  });

  test("strona główna: wejście do aplikacji, dopisek i JSON-LD bez ceny", async ({ page }) => {
    await page.goto("/");
    const main = page.getByRole("main");
    await expect(main.getByRole("link", { name: "Załóż konto" }).first()).toHaveAttribute(
      "href",
      "/register",
    );
    await expect(main.getByRole("link", { name: "Zaloguj się" }).first()).toHaveAttribute("href", "/login");
    await expect(page.getByRole("note")).toContainText("nie stanowią porady inwestycyjnej");
    await expect(page.getByRole("note").getByRole("link")).toHaveAttribute("href", "/legal/risk");

    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}");
    expect(ld["@type"]).toBe("SoftwareApplication");
    expect(ld).not.toHaveProperty("offers");
    expect(ld).not.toHaveProperty("aggregateRating");

    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/icons\/og\.png$/);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(new URL(canonical ?? "").pathname).toBe("/");
    // Bez cen i obietnic zysku.
    // \b w JS nie zna polskich liter, stąd granice słowa przez \p{L}.
    await expect(main).not.toContainText(
      /(?<!\p{L})(zł|cena|cennik|zysk\p{L}*|zarobi\p{L}*)(?!\p{L})|PLN\s?\d|gwarant/iu,
    );
  });

  test("zalogowany trafia ze strony głównej na pulpit", async ({ authedPage: page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("dokumenty prawne: oznaczenie szkicu, noindex, wersja angielska", async ({ page }) => {
    await page.goto("/legal/terms");
    await expect(page.getByRole("complementary", { name: "Szkic do zatwierdzenia" })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("navigation", { name: "Spis treści" })).toBeVisible();
    // Notatki dla właściciela i radcy nie trafiają na stronę.
    await expect(page.getByRole("main")).not.toContainText("Miejsca do uzupełnienia");
    await expect(page.getByRole("main")).not.toContainText("Uwagi dla radcy");

    await page.getByRole("link", { name: "English" }).click();
    await expect(page).toHaveURL(/\/legal\/terms\?lang=en$/);
    await expect(page.getByRole("heading", { level: 1, name: "Neto Terms of Service" })).toBeVisible();
    await expect(page.getByText("the Polish version prevails")).toBeVisible();
  });

  test("usuwanie konta pod stałym adresem, bez logowania", async ({ page, request }) => {
    const res = await request.get("/legal/delete-account?lang=en", { maxRedirects: 0 });
    expect(res.status()).toBe(308);
    expect(res.headers()["location"]).toBe("/delete-account?lang=en");

    await page.goto("/delete-account?lang=en");
    await expect(
      page.getByRole("heading", { level: 1, name: "How to delete your Neto account" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "On iPhone" })).toBeVisible();
  });

  test("nieznany dokument to 404", async ({ request }) => {
    expect((await request.get("/legal/nie-ma")).status()).toBe(404);
  });
});

test.describe("PWA", () => {
  test("manifest z ikonami 192, 512 i maskowalną", async ({ page, request }) => {
    await page.goto("/");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);

    const res = await request.get("/manifest.webmanifest");
    expect(res.status()).toBe(200);
    const manifest = await res.json();
    expect(manifest).toMatchObject({ name: "Neto", display: "standalone", start_url: "/dashboard" });
    const icons = manifest.icons as { src: string; sizes: string; purpose: string }[];
    expect(icons.map((i) => `${i.sizes}/${i.purpose}`).sort()).toEqual([
      "192x192/any",
      "192x192/maskable",
      "512x512/any",
      "512x512/maskable",
    ]);
    for (const icon of icons) {
      const img = await request.get(icon.src);
      expect(img.status(), icon.src).toBe(200);
      expect(img.headers()["content-type"]).toBe("image/png");
    }
  });

  test("service worker: bez sieci strona offline, bez danych w pamięci", async ({ page, context }) => {
    // Bez tej flagi Playwright nie odcina sieci samemu workerowi (setOffline działa tylko na stronę).
    // Czytana przy podłączeniu workera, więc wystarczy na czas tego testu.
    process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1";
    test
      .info()
      .annotations.push({ type: "uwaga", description: "PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS" });
    const csp = collectCspErrors(page);
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    const sw = await page.request.get("/sw.js");
    expect(sw.headers()["cache-control"]).toContain("no-cache");

    await context.setOffline(true);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1, name: "Brak połączenia" })).toBeVisible();
    await context.setOffline(false);

    // W pamięci workera tylko powłoka: pliki statyczne, ikony, manifest i strona offline.
    const cached = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) {
        for (const req of await (await caches.open(name)).keys()) urls.push(new URL(req.url).pathname);
      }
      return urls;
    });
    expect(cached).toContain("/offline");
    for (const path of cached) {
      expect(path, path).toMatch(/^\/(_next\/static\/|icons\/|manifest\.webmanifest$|offline$)/);
    }
    expect(csp).toEqual([]);
    delete process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS;
  });
});

test.describe("SEO", () => {
  test("sitemap i robots bez ścieżek aplikacji", async ({ request }) => {
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    const xml = await sitemap.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
    expect(locs).toContain("/");
    for (const loc of locs) for (const app of APP_PATHS) expect(loc.startsWith(app), loc).toBe(false);

    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Sitemap:");
    for (const app of APP_PATHS.filter((p) => p !== "/api/")) expect(robots).not.toContain(app);
  });
});
