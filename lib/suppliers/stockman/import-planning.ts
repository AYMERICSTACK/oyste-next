/** Read-only planning from StockmanCatalogReference and StockmanImportDraft.
 * A catalogue index does NOT prove commercial-row badges, prices, or variant ownership.
 */
export type StockmanPlanningReference = {
  reference: string;
  designation: string;
  category: string | null;
  sourceUrl: string;
  isActive: boolean;
  targetId: string | null;
  productId: string | null;
  lastMatchStatus: string | null;
};
export type StockmanPlanningDraft = { reference: string; status: string; sourceReadAt: Date | null; purchasePriceExVat: unknown; stock: number | null };
export type PlanningState = "ALREADY_LINKED" | "PREPARED_DRAFT" | "SOURCE_REVIEW" | "INACTIVE";
export type PlanningCommercialHint = "ACCESSORY_PATH_REVIEW" | "UNCLASSIFIED_REVIEW";
export type StockmanPlanningRow = {
  reference: string;
  designation: string;
  category: string;
  sourceUrl: string;
  state: PlanningState;
  commercialHint: PlanningCommercialHint;
  hasCommercialDraft: boolean;
  hasPurchasePrice: boolean;
  hasNumericStock: boolean;
  sourceReadAt: string | null;
  autoImportAllowed: false;
};
const normalizeReference = (s: string) => s.trim().toUpperCase();
const accessoryPath = /(?:accessoir|\boptions?\b|pi[eè]ces? d[eé]tach[eé]es?)/i;
export function planStockmanReferences(references: readonly StockmanPlanningReference[], drafts: readonly StockmanPlanningDraft[]): StockmanPlanningRow[] {
  const byReference = new Map(drafts.map(d => [normalizeReference(d.reference), d]));
  return references.map(ref => {
    const draft = byReference.get(normalizeReference(ref.reference));
    const state: PlanningState = !ref.isActive ? "INACTIVE"
      : Boolean(ref.targetId || ref.productId) || ref.lastMatchStatus === "already_linked" ? "ALREADY_LINKED"
      : draft?.status === "PREPARED" ? "PREPARED_DRAFT" : "SOURCE_REVIEW";
    return {
      reference: ref.reference,
      designation: ref.designation,
      category: ref.category || "Sans categorie fournisseur",
      sourceUrl: ref.sourceUrl,
      state,
      commercialHint: accessoryPath.test([ref.category, ref.sourceUrl].filter(Boolean).join(" ")) ? "ACCESSORY_PATH_REVIEW" : "UNCLASSIFIED_REVIEW",
      hasCommercialDraft: Boolean(draft),
      hasPurchasePrice: draft?.purchasePriceExVat != null,
      hasNumericStock: draft?.stock != null,
      sourceReadAt: draft?.sourceReadAt?.toISOString() ?? null,
      autoImportAllowed: false,
    };
  });
}
export function summarizeStockmanPlanning(rows: readonly StockmanPlanningRow[]) {
  const totals: Record<PlanningState, number> = { ALREADY_LINKED: 0, PREPARED_DRAFT: 0, SOURCE_REVIEW: 0, INACTIVE: 0 };
  const familyMap = new Map<string, { category: string; total: number; linked: number; prepared: number; sourceReview: number; inactive: number; accessoryPathToReview: number }>();
  for (const row of rows) {
    totals[row.state]++;
    const key = row.category;
    const family = familyMap.get(key) ?? { category: key, total: 0, linked: 0, prepared: 0, sourceReview: 0, inactive: 0, accessoryPathToReview: 0 };
    family.total++;
    if (row.state === "ALREADY_LINKED") family.linked++;
    if (row.state === "PREPARED_DRAFT") family.prepared++;
    if (row.state === "SOURCE_REVIEW") family.sourceReview++;
    if (row.state === "INACTIVE") family.inactive++;
    if (row.commercialHint === "ACCESSORY_PATH_REVIEW") family.accessoryPathToReview++;
    familyMap.set(key, family);
  }
  return { totals: { ...totals, all: rows.length }, families: [...familyMap.values()].sort((a, b) => b.total - a.total || a.category.localeCompare(b.category)) };
}
