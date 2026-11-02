import "server-only";
import { strToU8, zipSync } from "fflate";
import type { PrismaClient } from "@/generated/prisma/client";
import { decryptOptional } from "@/lib/crypto/fields";
import { scopedDb } from "@/lib/db/scoped";

/**
 * Eksport danych użytkownika (RODO, SPEC HU-1.7): ZIP z pełnym JSON i plikami CSV.
 * Bez skrótów haseł, sekretów 2FA, kodów zapasowych i tokenów sesji.
 */

type Row = Record<string, unknown>;

export function toCsv(rows: Row[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    const s = v instanceof Date ? v.toISOString() : v === null || v === undefined ? "" : String(v);
    // Ochrona przed wstrzyknięciem formuł w arkuszach (=, +, -, @ na początku).
    const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
    return /[";\n\r,]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n") + "\r\n";
}

const plain = (v: unknown): unknown =>
  JSON.parse(JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x)));

export async function buildUserExport(base: PrismaClient, userId: string, now = new Date()) {
  const db = scopedDb(base, userId);
  const [user, accounts, transactions, holdings, goals, snapshots, notifications, prefs, sessions] =
    await Promise.all([
      db.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          birthYear: true,
          locale: true,
          baseCurrency: true,
          theme: true,
          emailVerified: true,
          totpEnabledAt: true,
          termsAcceptedAt: true,
          createdAt: true,
        },
      }),
      db.financialAccount.findMany({
        include: { liability: true, deposit: true },
        orderBy: { createdAt: "asc" },
      }),
      db.transaction.findMany({ orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
      db.holding.findMany({ include: { lots: true, asset: true } }),
      db.goal.findMany({ include: { accounts: true } }),
      db.portfolioSnapshot.findMany({ orderBy: { date: "asc" } }),
      db.notification.findMany({ orderBy: { createdAt: "asc" } }),
      db.notificationPref.findMany(),
      db.session.findMany({ select: { platform: true, userAgent: true, createdAt: true, lastSeenAt: true } }),
    ]);

  const accountsOut = accounts.map(({ notesEnc, accountNumberEnc, ...a }) => ({
    ...a,
    notes: decryptOptional(notesEnc),
    accountNumber: decryptOptional(accountNumberEnc),
  }));

  const data = plain({
    exportedAt: now.toISOString(),
    format: "neto-export-v1",
    user,
    accounts: accountsOut,
    transactions,
    holdings,
    goals,
    portfolioSnapshots: snapshots,
    notifications,
    notificationPreferences: prefs,
    sessions,
  });

  const files = {
    "neto-dane.json": strToU8(JSON.stringify(data, null, 2)),
    "konta.csv": strToU8(
      toCsv(
        accountsOut.map((a) => ({
          id: a.id,
          nazwa: a.name,
          rodzaj: a.kind,
          typ: a.type,
          waluta: a.currency,
          instytucja: a.institution,
          opakowanie: a.taxWrapper,
          udzial: a.ownershipShare.toString(),
          zarchiwizowane: a.archivedAt,
        })),
      ),
    ),
    "transakcje.csv": strToU8(
      toCsv(
        transactions.map((t) => ({
          id: t.id,
          konto: t.accountId,
          instrument: t.assetId,
          typ: t.type,
          data: t.date.toISOString().slice(0, 10),
          ilosc: t.quantity?.toString() ?? "",
          cena: t.price?.toString() ?? "",
          kwota: t.amount.toString(),
          waluta: t.currency,
          kurs: t.fxRate?.toString() ?? "",
          oplata: t.fee?.toString() ?? "",
          notatka: t.note,
        })),
      ),
    ),
    "migawki-wartosci-netto.csv": strToU8(
      toCsv(
        snapshots.map((s) => ({
          data: s.date.toISOString().slice(0, 10),
          aktywa: s.assets.toString(),
          zobowiazania: s.liabilities.toString(),
          wartosc_netto: s.netWorth.toString(),
        })),
      ),
    ),
  };
  return zipSync(files, { level: 6 });
}
