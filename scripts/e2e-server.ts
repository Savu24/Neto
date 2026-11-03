/**
 * Serwer do testów e2e (Playwright webServer): tymczasowy Postgres (albo TEST_DATABASE_URL w CI),
 * migracje i `next start` na zbudowanej aplikacji z testowymi kluczami. E-maile trafiają do test-results/mail.
 * Nigdy nie używa .env.local ani produkcyjnych zmiennych.
 */
import EmbeddedPostgres from "embedded-postgres";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { runSeedCatalog } from "./seed-catalog";

const PORT = Number(process.env.E2E_PORT ?? 3100);
export const MAIL_DIR = path.resolve("test-results/mail");

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      srv.close(() => (typeof address === "object" && address ? resolve(address.port) : reject()));
    });
  });
}

async function main() {
  let pg: EmbeddedPostgres | null = null;
  let dir: string | null = null;
  let url = process.env.TEST_DATABASE_URL;

  if (!url) {
    dir = mkdtempSync(path.join(tmpdir(), "neto-e2e-db-"));
    const port = await freePort();
    pg = new EmbeddedPostgres({
      databaseDir: dir,
      user: "neto",
      password: "neto-e2e",
      port,
      persistent: false,
      autoRehydrateSymlinks: true,
      initdbFlags: ["--encoding=UTF8", "--locale=C"],
      onLog: () => {},
      onError: () => {},
    });
    await pg.initialise();
    await pg.start();
    await pg.createDatabase("neto_e2e");
    url = `postgresql://neto:neto-e2e@127.0.0.1:${port}/neto_e2e`;
  }

  execFileSync(process.execPath, [path.resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
  // Katalog wspólny instrumentów do wyszukiwarki (HU-2.2).
  await runSeedCatalog(url);
  rmSync(MAIL_DIR, { recursive: true, force: true });

  const child = spawn(
    process.execPath,
    [path.resolve("node_modules/next/dist/bin/next"), "start", "-p", String(PORT)],
    {
      stdio: "inherit",
      env: {
        // Celowo bez ...process.env z sekretami: tylko to, czego potrzebuje test.
        PATH: process.env.PATH,
        SYSTEMROOT: process.env.SYSTEMROOT,
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
        DATABASE_URL: url,
        APP_URL: `http://localhost:${PORT}`,
        AUTH_SECRET: randomBytes(32).toString("base64"),
        FIELD_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
        MAIL_OUTBOX_DIR: MAIL_DIR,
      },
    },
  );

  const cleanup = async () => {
    child.kill();
    if (pg) await pg.stop().catch(() => {});
    if (dir) rmSync(dir, { recursive: true, force: true });
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  child.on("exit", cleanup);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
