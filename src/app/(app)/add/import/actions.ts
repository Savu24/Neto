"use server";

import { revalidatePath } from "next/cache";
import { gunzipSync } from "node:zlib";
import { getT } from "@/i18n/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { scopedDb } from "@/lib/db/scoped";
import { CsvError, MAX_FILE_BYTES } from "@/lib/portfolio/import/csv";
import {
  analyzeImport,
  commitImport,
  ImportError,
  previewImport,
  revertImport,
  validMapping,
  type Analysis,
  type ImportFile,
  type ImportResult,
  type Preview,
} from "@/lib/portfolio/import/service";
import { LedgerError, type Ledger } from "@/lib/portfolio/ledger/service";
import { todayKey } from "@/lib/portfolio/valuation";

/**
 * Akcje importu CSV (HU-2.4). Klient wysyła plik skompresowany gzipem (limit ciała żądania akcji to 1 MB,
 * a plik może mieć 5 MB) razem z mapowaniem; serwer niczego nie przechowuje między krokami.
 */

export type ImportActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function ledger(): Promise<Ledger> {
  const { user } = await requireUser();
  return { db: scopedDb(db(), user.id), userId: user.id, today: todayKey() };
}

class FileError extends Error {}

async function readFile(fd: FormData): Promise<ImportFile> {
  const file = fd.get("file");
  if (!(file instanceof Blob)) throw new FileError("file");
  let bytes = new Uint8Array(await file.arrayBuffer());
  if (fd.get("gzip") === "1") {
    try {
      bytes = new Uint8Array(gunzipSync(bytes, { maxOutputLength: MAX_FILE_BYTES + 1 }));
    } catch (e) {
      if ((e as { code?: string }).code === "ERR_BUFFER_TOO_LARGE") throw new CsvError("tooLarge");
      throw new FileError("file");
    }
  }
  return {
    accountId: String(fd.get("accountId") ?? ""),
    fileName: String(fd.get("fileName") ?? "plik.csv"),
    bytes,
  };
}

async function fail(e: unknown): Promise<{ ok: false; error: string }> {
  const t = await getT("import");
  if (e instanceof CsvError) return { ok: false, error: t(`err_${e.code}`) };
  if (e instanceof ImportError) return { ok: false, error: t(`err_${e.code}`, e.params) };
  if (e instanceof FileError) return { ok: false, error: t("err_file") };
  if (e instanceof LedgerError)
    return { ok: false, error: (await getT("transactions"))(`err_${e.code}`, e.params) };
  console.error(e);
  return { ok: false, error: t("err_generic") };
}

function mappingFrom(fd: FormData, headers: readonly string[]) {
  try {
    return validMapping(JSON.parse(String(fd.get("mapping") ?? "null")), headers);
  } catch {
    return null;
  }
}

export async function analyzeImportAction(fd: FormData): Promise<ImportActionResult<Analysis>> {
  try {
    const l = await ledger();
    return { ok: true, data: await analyzeImport(l, await readFile(fd)) };
  } catch (e) {
    return fail(e);
  }
}

export async function previewImportAction(fd: FormData): Promise<ImportActionResult<Preview>> {
  try {
    const l = await ledger();
    const file = await readFile(fd);
    const analysis = await analyzeImport(l, file);
    const mapping = mappingFrom(fd, analysis.headers);
    if (!mapping) throw new ImportError("mapping");
    return { ok: true, data: await previewImport(l, file, mapping) };
  } catch (e) {
    return fail(e);
  }
}

export async function commitImportAction(fd: FormData): Promise<ImportActionResult<ImportResult>> {
  try {
    const l = await ledger();
    const file = await readFile(fd);
    const analysis = await analyzeImport(l, file);
    const mapping = mappingFrom(fd, analysis.headers);
    if (!mapping) throw new ImportError("mapping");
    const result = await commitImport(l, file, mapping);
    revalidatePath("/", "layout");
    return { ok: true, data: result };
  } catch (e) {
    return fail(e);
  }
}

export async function revertImportAction(batchId: string): Promise<ImportActionResult<{ count: number }>> {
  try {
    const l = await ledger();
    const r = await revertImport(l, batchId);
    revalidatePath("/", "layout");
    return { ok: true, data: { count: r.reverted } };
  } catch (e) {
    return fail(e);
  }
}
