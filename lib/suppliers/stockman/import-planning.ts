/** STOCKMAN V31.1: read-only inventory planning. No inference of sellability or variant ownership. */
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
export type StockmanPlanningDraft = {
  reference: string;
  status: string;
  sourceReadAt: Date | null;
  purchasePriceExVat: unknown;
  stock: number | null;
};
export type PlanningState = "ALREADY_LINKED" | "PREPARED_DRAFT" | "SOURCE_REVIEW" | "INACTIVE";
export type PlanningCommercialHint = "ACCESSORY_PATH_REVIEW" | "UNCLASSIFIED_REVIEW";
export type StockmanPlanningRow = {
  reference: string;
  designation: string;
  category: string;
  categoryEvidence: "SOURCE_URL" | "LEGACY_INDEX" | "UNKNOWN";
  rawIndexCategory: string | null;
  referenceQuality: "SUSPECT_REVIEW" | "UNVERIFIED";
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
const invalidIndexCategory = (s: string) => !s || s === ">" || s.length > 100 || /[\n\r<>]/.test(s) || /plus d.infos|more info/i.test(s);

/** Read category hierarchy from actual STOCKMAN URL path; never from commercial designation. */
export function supplierFamilyFromUrl(sourceUrl: string): string | null {
  try {
    const url = new URL(sourceUrl);
    if (!/(^|\.)stockman\.fr$/i.test(url.hostname)) return null;
    const pieces = url.pathname.split("/").filter(Boolean).map(p => decodeURIComponent(p));
    const hierarchy = pieces
      .filter(p => !/^(?:fr|en)$/i.test(p))
      .map(p => /^(.+?)--\d+$/.exec(p))
      .filter((m): m is RegExpExecArray => Boolean(m))
      .map(m => m[1].replace(/-/g, " ").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    return hierarchy.length >= 2 ? hierarchy.slice(0, 2).join(" / ") : hierarchy[0] ?? null;
  } catch {
    return null;
  }
}

/** Conservatively flag apparent extraction noise without removing any indexed record. */
export function referenceLooksSuspicious(reference: string): boolean {
  const r = reference.trim();
  return !r || r.length > 65 || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(r)
    || /^\d+(?:[.,]\d+)?\s*(?:v|w|kg|g|ah)\.?$/i.test(r)
    || /^\d+(?:v|w)\/[\d.,]+$/i.test(r)
    || /[.!?:;]$/.test(r) || /\s{2,}/.test(r);
}

export function planStockmanReferences(references: readonly StockmanPlanningReference[], drafts: readonly StockmanPlanningDraft[]): StockmanPlanningRow[] {
  const byReference = new Map(drafts.map(d => [normalizeReference(d.reference), d]));
  return references.map(ref => {
    const draft = byReference.get(normalizeReference(ref.reference));
    const state: PlanningState = !ref.isActive ? "INACTIVE"
      : Boolean(ref.targetId || ref.productId) || ref.lastMatchStatus === "already_linked" ? "ALREADY_LINKED"
      : draft?.status === "PREPARED" ? "PREPARED_DRAFT" : "SOURCE_REVIEW";
    const familyFromUrl = supplierFamilyFromUrl(ref.sourceUrl);
    const rawIndexCategory = ref.category?.trim() || null;
    const safeIndexCategory = rawIndexCategory && !invalidIndexCategory(rawIndexCategory) ? rawIndexCategory : null;
    return {
      reference: ref.reference,
      designation: ref.designation,
      category: familyFromUrl ?? safeIndexCategory ?? "Famille fournisseur a verifier",
      categoryEvidence: familyFromUrl ? "SOURCE_URL" : safeIndexCategory ? "LEGACY_INDEX" : "UNKNOWN",
      rawIndexCategory,
      referenceQuality: referenceLooksSuspicious(ref.reference) ? "SUSPECT_REVIEW" : "UNVERIFIED",
      sourceUrl: ref.sourceUrl,
      state,
      commercialHint: accessoryPath.test([familyFromUrl, safeIndexCategory, ref.sourceUrl].filter(Boolean).join(" ")) ? "ACCESSORY_PATH_REVIEW" : "UNCLASSIFIED_REVIEW",
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
  const categoryEvidence = { SOURCE_URL: 0, LEGACY_INDEX: 0, UNKNOWN: 0 };
  let suspectReferences = 0;
  const familyMap = new Map<string, { category: string; total: number; linked: number; prepared: number; sourceReview: number; inactive: number; accessoryPathToReview: number; suspectReferences: number }>();
  for (const row of rows) {
    totals[row.state]++;
    categoryEvidence[row.categoryEvidence]++;
    if (row.referenceQuality === "SUSPECT_REVIEW") suspectReferences++;
    const family = familyMap.get(row.category) ?? { category: row.category, total: 0, linked: 0, prepared: 0, sourceReview: 0, inactive: 0, accessoryPathToReview: 0, suspectReferences: 0 };
    family.total++;
    if (row.state === "ALREADY_LINKED") family.linked++;
    if (row.state === "PREPARED_DRAFT") family.prepared++;
    if (row.state === "SOURCE_REVIEW") family.sourceReview++;
    if (row.state === "INACTIVE") family.inactive++;
    if (row.commercialHint === "ACCESSORY_PATH_REVIEW") family.accessoryPathToReview++;
    if (row.referenceQuality === "SUSPECT_REVIEW") family.suspectReferences++;
    familyMap.set(row.category, family);
  }
  return {
    totals: { ...totals, all: rows.length },
    quality: { categoryEvidence, suspectReferences },
    families: [...familyMap.values()].sort((a, b) => b.total - a.total || a.category.localeCompare(b.category)),
  };
}
