/**
 * Lokalna baza PostgreSQL bez Dockera (embedded-postgres). Tylko do pracy lokalnej i testów.
 *   npm run db:start   — uruchamia klaster w .local-db/ (Ctrl+C zatrzymuje), tworzy bazy neto_dev i neto_test,
 *                        a przy pierwszym starcie zapisuje DATABASE_URL do .env.local.
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const LOCAL_DB = {
  user: "neto",
  password: "neto-local-only",
  port: Number(process.env.LOCAL_DB_PORT ?? 54329),
};

export function localUrl(database: string, port = LOCAL_DB.port) {
  return `postgresql://${LOCAL_DB.user}:${LOCAL_DB.password}@127.0.0.1:${port}/${database}`;
}

export async function ensureDatabase(pg: EmbeddedPostgres, name: string) {
  const client = pg.getPgClient();
  await client.connect();
  try {
    const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (exists.rowCount === 0) await pg.createDatabase(name);
  } finally {
    await client.end();
  }
}

function writeEnvLocal(url: string) {
  const file = path.resolve(".env.local");
  const current = existsSync(file) ? readFileSync(file, "utf8") : "";
  if (/^DATABASE_URL=.+$/m.test(current)) return false;
  const next = current.replace(/^DATABASE_URL=.*$/m, "").trimEnd();
  writeFileSync(file, `${next ? next + "\n" : ""}DATABASE_URL=${url}\n`);
  return true;
}

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: path.resolve(".local-db/data"),
    user: LOCAL_DB.user,
    password: LOCAL_DB.password,
    port: LOCAL_DB.port,
    persistent: true,
    autoRehydrateSymlinks: true,
    // Bez tego klaster na Windowsie dostaje WIN1252 i nie przyjmuje polskich znaków.
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
  });

  if (!existsSync(path.resolve(".local-db/data/PG_VERSION"))) await pg.initialise();
  await pg.start();
  await ensureDatabase(pg, "neto_dev");
  await ensureDatabase(pg, "neto_test");

  const url = localUrl("neto_dev");
  const wrote = writeEnvLocal(url);
  console.log(`Lokalna baza działa na porcie ${LOCAL_DB.port} (bazy: neto_dev, neto_test).`);
  if (wrote) console.log("Zapisano DATABASE_URL do .env.local.");
  console.log("Dalej: npm run db:migrate, npm run db:seed. Ctrl+C zatrzymuje bazę.");

  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
