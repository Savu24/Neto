import type { PrismaClient } from "@/generated/prisma/client";
import { CATALOG, type CatalogInstrument } from "./instruments";

/** Stały identyfikator rekordu katalogu: ponowny seed aktualizuje, nie dubluje. */
export function catalogId(i: Pick<CatalogInstrument, "exchange" | "symbol">): string {
  return `cat-${(i.exchange ?? "none").toLowerCase()}-${i.symbol.toLowerCase()}`;
}

/**
 * Zapis katalogu wspólnego (`Asset.userId = null`). Zadanie systemowe na surowym kliencie
 * (scopedDb nie pozwala pisać do katalogu). Idempotentne; niczego nie usuwa.
 */
export async function seedCatalog(db: PrismaClient): Promise<number> {
  for (const i of CATALOG) {
    const data = {
      name: i.name,
      symbol: i.symbol,
      isin: i.isin,
      exchange: i.exchange,
      assetClass: i.assetClass,
      currency: i.currency,
      priceSource: "PROVIDER" as const,
    };
    await db.asset.upsert({
      where: { id: catalogId(i) },
      create: { id: catalogId(i), userId: null, ...data },
      update: data,
    });
  }
  return CATALOG.length;
}
