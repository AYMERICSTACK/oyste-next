/** V34: controlled read-only supplier evidence for the STF N and BS premium pilot. */
import type { StockmanCommercialFamily } from "./types";

export const PILOTS_V34 = {
  STF_N: {
    sourceUrl: "https://www.stockman.fr/tables-elevatrices--16/tables-elevatrices-manuelles--97/--1/table-elevatrice-manuelle-economique-150-a-500-kg--STF%20N.aspx",
    references: ["STF15N", "STF30N", "STF50N"],
  },
  BS: {
    sourceUrl: "https://www.stockman.fr/tables-elevatrices--16/tables-elevatrices-manuelles--97/--1/table-elevatrice-manuelle-premium-150-a-1000-kg--BS.aspx",
    references: ["BS100", "BS15", "BS25", "BS50", "BS75"],
  },
} as const;
export type PilotV34 = keyof typeof PILOTS_V34;
export const isPilotV34 = (value: string | null): value is PilotV34 =>
  value != null && Object.prototype.hasOwnProperty.call(PILOTS_V34, value);

const normalize = (s: string) => s.trim().toUpperCase();
const canonical = (raw: string): string | null => {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.hostname !== "www.stockman.fr") return null;
    u.search = ""; u.hash = "";
    u.pathname = u.pathname.replace(/^\/(?:fr|en)\//i, "/");
    return u.toString();
  } catch { return null; }
};
const validPrice = (value: number) => Number.isFinite(value) && value > 0;
const validStock = (value: number) => Number.isSafeInteger(value) && value >= 0;
const safeMedia = (url: string) => {
  try { const u = new URL(url); return u.protocol === "https:" && /(^|\.)stockman\.fr$/i.test(u.hostname); }
  catch { return false; }
};

export type PilotIndexRowV34 = {
  reference: string;
  sourceUrl: string;
  reconciliationStatus: string;
  referenceQuality: string;
  isActive: boolean;
};

export function auditLiftTableLiveV34(
  pilot: PilotV34,
  index: readonly PilotIndexRowV34[],
  family: StockmanCommercialFamily,
  checkedAt: string,
) {
  const config = PILOTS_V34[pilot];
  const expected = new Set<string>(config.references);
  const indexByRef = new Map<string, PilotIndexRowV34[]>();
  for (const r of index) {
    const k = normalize(r.reference);
    if (!expected.has(k)) continue;
    indexByRef.set(k, [...(indexByRef.get(k) ?? []), r]);
  }
  const unexpected = family.products.map(p => normalize(p.reference)).filter(r => !expected.has(r));
  const duplicates = family.products.map(p => normalize(p.reference)).filter((r, i, all) => all.indexOf(r) !== i);
  const resolvedUrl = canonical(family.pageUrl);
  const requestedUrl = canonical(config.sourceUrl);
  const pageVerified = family.kind === "product_page" && resolvedUrl != null && resolvedUrl === requestedUrl;
  const byRef = new Map(family.products.map(p => [normalize(p.reference), p]));
  const rows = config.references.map(reference => {
    const entries = indexByRef.get(reference) ?? [];
    const item = byRef.get(reference);
    const blockers: string[] = [];
    if (entries.length !== 1) blockers.push("INDEX_MISSING_OR_DUPLICATED");
    if (entries.some(e => !e.isActive || e.reconciliationStatus !== "SOURCE_REVIEW" || e.referenceQuality === "SUSPECT_REVIEW" || canonical(e.sourceUrl) !== requestedUrl))
      blockers.push("INDEX_RECONCILIATION_BLOCKED");
    if (!pageVerified) blockers.push("SOURCE_PAGE_NOT_CONFIRMED");
    if (!item) blockers.push("SUPPLIER_ROW_MISSING");
    if (duplicates.includes(reference)) blockers.push("DUPLICATE_SUPPLIER_ROW");
    if (item && (!validPrice(item.purchasePriceExVat) || item.priceOnRequest)) blockers.push("PURCHASE_PRICE_NOT_NUMERIC");
    if (item && (!validStock(item.stock) || item.stockOnRequest)) blockers.push("SUPPLIER_STOCK_NOT_CONFIRMED");
    if (item && (!Number.isFinite(Date.parse(item.readAt)) || Math.abs(Date.parse(checkedAt) - Date.parse(item.readAt)) > 2 * 3600000)) blockers.push("SOURCE_TIMESTAMP_INCONSISTENT");
    // Freight, sales margin, OYSTE category and commercial grouping require a separate controlled approval.
    blockers.push("STRUCTURE_NOT_VALIDATED", "OYSTE_CATEGORY_NOT_VALIDATED", "SALE_PRICE_AND_FREIGHT_NOT_VALIDATED");
    return {
      reference,
      designation: item?.designation ?? null,
      purchasePriceExVat: item && validPrice(item.purchasePriceExVat) && !item.priceOnRequest ? item.purchasePriceExVat : null,
      priceOnRequest: item?.priceOnRequest ?? null,
      supplierStock: item && validStock(item.stock) && !item.stockOnRequest ? item.stock : null,
      stockOnRequest: item?.stockOnRequest ?? null,
      weightKg: item && item.weightKg != null && Number.isFinite(item.weightKg) && item.weightKg >= 0 ? item.weightKg : null,
      barcode: null,
      sourceReadAt: item?.readAt ?? null,
      images: (item?.images ?? []).filter(i => safeMedia(i.url)).slice(0, 10),
      documents: (item?.documents ?? []).filter(d => safeMedia(d.url)).slice(0, 10),
      features: (item?.features ?? []).slice(0, 30),
      blockers,
      readyForImport: false as const,
    };
  });
  return {
    version: "STOCKMAN_LIFT_TABLE_LIVE_V34" as const,
    mode: "LIVE_READ_ONLY" as const,
    pilot,
    sourceUrl: config.sourceUrl,
    finalUrl: family.pageUrl,
    familyDesignation: family.familyDesignation,
    checkedAt,
    summary: {
      expectedReferences: config.references.length,
      supplierRows: family.products.length,
      matchedRows: rows.filter(r => r.designation != null).length,
      withNumericPrice: rows.filter(r => r.purchasePriceExVat != null).length,
      withNumericStock: rows.filter(r => r.supplierStock != null).length,
      missingReferences: rows.filter(r => r.designation == null).map(r => r.reference),
      unexpectedReferences: [...new Set(unexpected)],
      duplicateSupplierReferences: [...new Set(duplicates)],
      sourcePageVerified: pageVerified,
      readyForImport: 0,
    },
    rows,
    warnings: [
      "Les donnees sont lues a l instant T via la session STOCKMAN; aucune persistance Neon.",
      "Un stock numerique n implique pas une promesse de disponibilite client.",
      "La presence de plusieurs lignes ne prouve pas une structure de variantes.",
      "Prix de vente, transport, categorie OYSTE et publication restent non valides.",
    ],
  };
}
