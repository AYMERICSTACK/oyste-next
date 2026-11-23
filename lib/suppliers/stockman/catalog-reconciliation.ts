/** V32: read-only reconciliation; evidence of an OYSTE product is not evidence of commercial readiness. */
import { planStockmanReferences, type StockmanPlanningDraft, type StockmanPlanningReference } from "./import-planning";

export type OysteStockmanProduct = {
  id: string; code: string; supplierCode: string | null; parentCode?: string | null;
  publicationStatus: string; sourceData: unknown;
};
export type OysteStockmanVariant = {
  id: string; productId: string; code: string; supplierCode: string | null; sourceData: unknown;
};
export type ReconciliationStatus =
  | "CONFIRMED_IN_OYSTE" | "AMBIGUOUS_MATCH" | "INDEX_LINK_UNVERIFIED"
  | "DRAFT_NO_PRODUCT" | "SOURCE_REVIEW" | "INACTIVE";

export type ReconciliationRow = ReturnType<typeof planStockmanReferences>[number] & {
  reconciliationStatus: ReconciliationStatus;
  matchingProductIds: string[];
  matchingVariantIds: string[];
  matchingMethods: string[];
  reconciliationNotes: string[];
};
const norm = (value: string | null | undefined) => (value || "").trim().toUpperCase();

function stockmanReferenceFromData(data: unknown): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const stockman = (data as Record<string, unknown>).stockman;
  if (!stockman || typeof stockman !== "object" || Array.isArray(stockman)) return null;
  const reference = (stockman as Record<string, unknown>).reference;
  return typeof reference === "string" && reference.trim() ? reference : null;
}

type Candidate = { kind: "PRODUCT" | "VARIANT"; id: string; productId: string; method: string };
export function reconcileStockmanCatalog(
  references: readonly StockmanPlanningReference[], drafts: readonly StockmanPlanningDraft[],
  products: readonly OysteStockmanProduct[], variants: readonly OysteStockmanVariant[],
): ReconciliationRow[] {
  const lookup = new Map<string, Candidate[]>();
  const add = (reference: string | null | undefined, candidate: Candidate) => {
    const key = norm(reference);
    if (!key) return;
    const candidates = lookup.get(key) || [];
    if (!candidates.some(x => x.kind === candidate.kind && x.id === candidate.id && x.method === candidate.method)) candidates.push(candidate);
    lookup.set(key, candidates);
  };
  for (const p of products) {
    add(p.code, { kind: "PRODUCT", id: p.id, productId: p.id, method: "product.code" });
    add(p.supplierCode, { kind: "PRODUCT", id: p.id, productId: p.id, method: "product.supplierCode" });
    add(stockmanReferenceFromData(p.sourceData), { kind: "PRODUCT", id: p.id, productId: p.id, method: "product.sourceData.stockman.reference" });
  }
  for (const v of variants) {
    add(v.code, { kind: "VARIANT", id: v.id, productId: v.productId, method: "variant.code" });
    add(v.supplierCode, { kind: "VARIANT", id: v.id, productId: v.productId, method: "variant.supplierCode" });
    add(stockmanReferenceFromData(v.sourceData), { kind: "VARIANT", id: v.id, productId: v.productId, method: "variant.sourceData.stockman.reference" });
  }
  const base = planStockmanReferences(references, drafts);
  return base.map((row, i) => {
    const indexed = references[i];
    const found = lookup.get(norm(row.reference)) ?? [];
    const productIds = [...new Set(found.map(x => x.productId))].sort();
    const productMatches = [...new Set(found.filter(x => x.kind === "PRODUCT").map(x => x.id))].sort();
    const variantMatches = [...new Set(found.filter(x => x.kind === "VARIANT").map(x => x.id))].sort();
    const notes: string[] = [];
    if (found.length && indexed.productId && !productIds.includes(indexed.productId)) notes.push("INDEX_PRODUCT_ID_DISAGREES");
    // targetId is not guaranteed to be a Product id (targetType may be another entity).
    if (indexed.targetId && (indexed as StockmanPlanningReference & { targetType?: string | null }).targetType === "PRODUCT" && !productIds.includes(indexed.targetId) && found.length) notes.push("INDEX_TARGET_ID_DISAGREES");
    const multipleEntities = productMatches.length + variantMatches.length > 1;
    const indexContradiction = notes.length > 0;
    const status: ReconciliationStatus = !indexed.isActive ? "INACTIVE"
      : multipleEntities || indexContradiction ? "AMBIGUOUS_MATCH"
      : found.length ? "CONFIRMED_IN_OYSTE"
      : row.state === "ALREADY_LINKED" ? "INDEX_LINK_UNVERIFIED"
      : row.hasCommercialDraft ? "DRAFT_NO_PRODUCT" : "SOURCE_REVIEW";
    if (found.length && !indexed.isActive) notes.push("INACTIVE_BUT_PRODUCT_EXISTS");
    if (status === "INDEX_LINK_UNVERIFIED") notes.push("INDEX_LINK_NOT_VERIFIED_IN_OYSTE");
    if (status === "DRAFT_NO_PRODUCT") notes.push("COMMERCIAL_DRAFT_NOT_PRODUCT");
    if (row.referenceQuality === "SUSPECT_REVIEW") notes.push("SUSPECT_REFERENCE");
    return {
      ...row, reconciliationStatus: status, matchingProductIds: productIds,
      matchingVariantIds: variantMatches, matchingMethods: [...new Set(found.map(x => x.method))].sort(),
      reconciliationNotes: notes,
    };
  });
}

export function summarizeStockmanReconciliation(rows: readonly ReconciliationRow[]) {
  const counts: Record<ReconciliationStatus, number> = {
    CONFIRMED_IN_OYSTE: 0, AMBIGUOUS_MATCH: 0, INDEX_LINK_UNVERIFIED: 0,
    DRAFT_NO_PRODUCT: 0, SOURCE_REVIEW: 0, INACTIVE: 0,
  };
  const families = new Map<string, { family: string; total: number; confirmed: number; unverifiedIndexLinks: number; draftsNoProduct: number; review: number; ambiguous: number; inactive: number }>();
  for (const row of rows) {
    counts[row.reconciliationStatus]++;
    const item = families.get(row.category) ?? { family: row.category, total: 0, confirmed: 0, unverifiedIndexLinks: 0, draftsNoProduct: 0, review: 0, ambiguous: 0, inactive: 0 };
    item.total++;
    if (row.reconciliationStatus === "CONFIRMED_IN_OYSTE") item.confirmed++;
    if (row.reconciliationStatus === "INDEX_LINK_UNVERIFIED") item.unverifiedIndexLinks++;
    if (row.reconciliationStatus === "DRAFT_NO_PRODUCT") item.draftsNoProduct++;
    if (row.reconciliationStatus === "SOURCE_REVIEW") item.review++;
    if (row.reconciliationStatus === "AMBIGUOUS_MATCH") item.ambiguous++;
    if (row.reconciliationStatus === "INACTIVE") item.inactive++;
    families.set(row.category, item);
  }
  return { totals: { ...counts, all: rows.length }, families: [...families.values()].sort((a, b) => b.total - a.total || a.family.localeCompare(b.family)) };
}
