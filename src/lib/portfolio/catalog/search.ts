import type { ScopedDb } from "@/lib/db/scoped";

/**
 * Wyszukiwarka instrumentów (HU-2.2): katalog wspólny i instrumenty własne użytkownika, po nazwie,
 * tickerze albo ISIN. Kolejność: dokładny ticker/ISIN, początek tickera, potem nazwa.
 * Dostawca danych (gdy włączony) dojdzie w Etapie 6.
 */

export interface InstrumentHit {
  readonly id: string;
  readonly name: string;
  readonly symbol: string | null;
  readonly isin: string | null;
  readonly exchange: string | null;
  readonly assetClass: string;
  readonly currency: string;
  readonly own: boolean;
}

export async function searchInstruments(db: ScopedDb, query: string, limit = 12): Promise<InstrumentHit[]> {
  const q = query.trim().slice(0, 60);
  if (q.length < 1) return [];
  const rows = await db.asset.findMany({
    where: {
      active: true,
      assetClass: { not: "RETAIL_BOND" },
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { symbol: { startsWith: q, mode: "insensitive" } },
        { isin: { startsWith: q, mode: "insensitive" } },
      ],
    },
    take: 60,
  });
  const u = q.toUpperCase();
  const rank = (r: (typeof rows)[number]) =>
    r.symbol?.toUpperCase() === u || r.isin?.toUpperCase() === u
      ? 0
      : r.symbol?.toUpperCase().startsWith(u)
        ? 1
        : r.name.toUpperCase().startsWith(u)
          ? 2
          : 3;
  return rows
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "pl"))
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      name: r.name,
      symbol: r.symbol,
      isin: r.isin,
      exchange: r.exchange,
      assetClass: r.assetClass,
      currency: r.currency,
      own: r.userId !== null,
    }));
}
