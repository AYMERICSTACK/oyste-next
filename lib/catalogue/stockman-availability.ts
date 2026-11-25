import "server-only";
import { prisma } from "@/lib/db/prisma";
import { isBlockedStockmanReference } from "@/lib/suppliers/stockman/order-policy";
import { normalizeStockmanReference, resolveStockmanAvailability, stockmanSourceObservation, unknownStockmanAvailability,
  type StockmanStockObservation, type StockmanAvailability } from "@/lib/suppliers/stockman/availability";
import type { CatalogueProduct } from "./repository";

/** Reads existing stores only. No supplier login, refresh, upsert or publication. */
export async function getStockmanAvailability(references: string[], now = Date.now()): Promise<Map<string, StockmanAvailability>> {
  const refs = [...new Set(references.map(normalizeStockmanReference).filter(Boolean))];
  const result = new Map(refs.map(ref => [ref, unknownStockmanAvailability(isBlockedStockmanReference(ref) ? "blocked" : "unknown")]));
  const allowed = refs.filter(ref => !isBlockedStockmanReference(ref));
  if (!allowed.length) return result;
  const referenceFilter = { in: allowed, mode: "insensitive" as const };
  const supplier = { OR: [{ name: { equals: "STOCKMAN", mode: "insensitive" as const } }, { slug: { equals: "stockman", mode: "insensitive" as const } }] };
  const identity = { OR: [{ supplierCode: referenceFilter }, { supplierCode: null, code: referenceFilter }, { supplierCode: "", code: referenceFilter }] };
  try {
    const [drafts, products, variants] = await Promise.all([
      prisma.stockmanImportDraft.findMany({ where: { reference: referenceFilter, status: { in: ["PREPARED", "IMPORTED"] } },
        select: { reference: true, stock: true, sourceReadAt: true } }),
      prisma.product.findMany({ where: { ...identity, supplier }, select: { code: true, supplierCode: true, sourceData: true } }),
      prisma.productVariant.findMany({ where: { ...identity, product: { supplier } }, select: { code: true, supplierCode: true, sourceData: true } }),
    ]);
    const observations: StockmanStockObservation[] = [
      ...drafts.map(row => ({ reference: row.reference, stock: row.stock, checkedAt: row.sourceReadAt })),
      ...[...products, ...variants].map(row => stockmanSourceObservation(row.supplierCode?.trim() || row.code, row.sourceData)),
    ];
    for (const ref of allowed) result.set(ref, resolveStockmanAvailability(ref, observations, now));
  } catch {
    // Partial reads cannot prove that an older snapshot has not been superseded.
    // Keep prices, product presentation and the six exclusions unchanged.
  }
  return result;
}

export async function applyStockmanAvailability(product: CatalogueProduct): Promise<CatalogueProduct> {
  if (product.manufacturer.trim().toUpperCase() !== "STOCKMAN") return product;
  const references = [product.supplierCode || product.code, ...(product.variants || []).map(v => v.supplierCode || v.code), ...(product.baseVariants || []).map(v => v.supplierCode || v.code)];
  const stocks = await getStockmanAvailability(references);
  const availability = (reference: string) => stocks.get(normalizeStockmanReference(reference)) ?? unknownStockmanAvailability();
  const mapStock = <T extends { supplierCode: string; code: string; stock: number | null }>(item: T): T & { stockAvailability: StockmanAvailability } => {
    const stockAvailability = availability(item.supplierCode || item.code);
    return { ...item, stock: stockAvailability.stock, stockAvailability };
  };
  return { ...mapStock(product), variants: product.variants?.map(mapStock), baseVariants: product.baseVariants?.map(mapStock) };
}
