/**
 * Baza do testów integracyjnych (*.db.test.ts). Domyślnie tymczasowy klaster embedded-postgres
 * w katalogu systemowym (usuwany po testach). W CI można podać TEST_DATABASE_URL (pusta baza testowa).
 * Nigdy nie używa DATABASE_URL z .env.local ani produkcyjnej bazy.
 */
import EmbeddedPostgres from "embedded-postgres";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      srv.close(() => (typeof address === "object" && address ? resolve(address.port) : reject()));
    });
  });
}

function migrate(url: string) {
  execFileSync(process.execPath, [path.resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}

export default async function setup(project: TestProject) {
  const external = process.env.TEST_DATABASE_URL;
  if (external) {
    if (!/localhost|127\.0\.0\.1|postgres:5432/.test(external)) {
      throw new Error("TEST_DATABASE_URL musi wskazywać bazę lokalną lub kontener CI");
    }
    migrate(external);
    project.provide("databaseUrl", external);
    return;
  }

  const dir = mkdtempSync(path.join(tmpdir(), "neto-test-db-"));
  const port = await freePort();
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: "neto",
    password: "neto-test",
    port,
    persistent: false,
    autoRehydrateSymlinks: true,
    // Bez tego klaster na Windowsie dostaje WIN1252 i nie przyjmuje polskich znaków.
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
    onError: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("neto_test");
  const url = `postgresql://neto:neto-test@127.0.0.1:${port}/neto_test`;
  migrate(url);
  project.provide("databaseUrl", url);

  return async () => {
    await pg.stop();
    rmSync(dir, { recursive: true, force: true });
  };
}
