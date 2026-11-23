/** V33: deterministic, read-only commercial preparation of two lift-table families. */
import type { ReconciliationRow } from "./catalog-reconciliation";

export const LIFT_TABLE_FAMILIES_V33 = [
  "tables elevatrices / tables elevatrices manuelles",
  "tables elevatrices / tables elevatrices electriques fixes simple ciseaux",
] as const;

export type LiftTableDraftEvidence = {
  reference: string;
  status: string;
  purchasePriceExVat: unknown;
  stock: number | null;
  sourceReadAt: Date | null;
  weightKg?: unknown;
};

const canonicalSource = (raw: string): string | null => {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !/(^|\.)stockman\.fr$/i.test(url.hostname)) return null;
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/^\/(?:fr|en)\//i, "/");
    return url.toString();
  } catch { return null; }
};
const key = (s: string) => s.trim().toUpperCase();
const validPrice = (value: unknown) => {
  if (value == null) return false;
  const n = Number(String(value));
  return Number.isFinite(n) && n > 0;
};
const freshEnough = (value: Date | null, now: Date, days: number) =>
  value instanceof Date && !Number.isNaN(value.getTime()) &&
  value.getTime() <= now.getTime() && now.getTime() - value.getTime() <= days * 86400000;

export function buildLiftTableBatchV33(
  reconciled: readonly ReconciliationRow[],
  drafts: readonly LiftTableDraftEvidence[],
  now = new Date(),
  freshnessDays = 7,
) {
  const candidates = reconciled.filter(r =>
    (LIFT_TABLE_FAMILIES_V33 as readonly string[]).includes(r.category));
  const byDraft = new Map(drafts.map(d => [key(d.reference), d]));
  const groups = new Map<string, {
    sourceUrl: string | null; family: string; references: Array<{
      reference: string; designation: string; reconciliationStatus: string;
      purchasePriceKnown: boolean; stockKnown: boolean; sourceFresh: boolean;
      blockers: string[];
    }>;
  }>();
  for (const r of candidates) {
    const canonical = canonicalSource(r.sourceUrl);
    const groupKey = `${r.category}::${canonical ?? `MISSING:${key(r.reference)}`}`;
    const group = groups.get(groupKey) ?? { sourceUrl: canonical, family: r.category, references: [] };
    const draft = byDraft.get(key(r.reference));
    const blockers: string[] = [];
    if (r.reconciliationStatus !== "SOURCE_REVIEW") blockers.push(`RECONCILIATION_${r.reconciliationStatus}`);
    if (r.referenceQuality === "SUSPECT_REVIEW") blockers.push("SUSPECT_REFERENCE");
    if (!canonical) blockers.push("INVALID_SUPPLIER_URL");
    if (r.commercialHint === "ACCESSORY_PATH_REVIEW") blockers.push("ACCESSORY_NATURE_TO_REVIEW");
    if (!draft) blockers.push("COMMERCIAL_DRAFT_MISSING");
    if (!validPrice(draft?.purchasePriceExVat)) blockers.push("PURCHASE_PRICE_MISSING");
    if (draft?.stock == null || !Number.isInteger(draft.stock) || draft.stock < 0) blockers.push("STOCK_UNVERIFIED");
    if (!freshEnough(draft?.sourceReadAt ?? null, now, freshnessDays)) blockers.push("SOURCE_READING_STALE");
    // Even complete evidence must be checked against supplier family, freight and selling policy.
    blockers.push("COMMERCIAL_STRUCTURE_UNVALIDATED", "OYSTE_CATEGORY_UNVALIDATED", "SALE_PRICE_AND_FREIGHT_UNVALIDATED");
    group.references.push({
      reference: r.reference, designation: r.designation,
      reconciliationStatus: r.reconciliationStatus,
      purchasePriceKnown: validPrice(draft?.purchasePriceExVat),
      stockKnown: draft?.stock != null && Number.isInteger(draft.stock) && draft.stock >= 0,
      sourceFresh: freshEnough(draft?.sourceReadAt ?? null, now, freshnessDays),
      blockers,
    });
    groups.set(groupKey, group);
  }
  const pages = [...groups.values()].map(g => ({
    ...g,
    references: g.references.sort((a,b)=>a.reference.localeCompare(b.reference)),
    grouping: "SOURCE_PAGE_CANDIDATE_NOT_VALIDATED_VARIANTS" as const,
    createAllowed: false as const,
  })).sort((a,b)=>a.family.localeCompare(b.family) || (a.sourceUrl ?? "").localeCompare(b.sourceUrl ?? ""));
  const references = pages.flatMap(p=>p.references);
  const statuses = Object.fromEntries([...new Set(references.map(r=>r.reconciliationStatus))].sort().map(status=>[
    status, references.filter(r=>r.reconciliationStatus===status).length,
  ]));
  return {
    version: "STOCKMAN_LIFT_TABLE_BATCH_V33" as const,
    mode: "READ_ONLY" as const,
    families: LIFT_TABLE_FAMILIES_V33,
    summary: {
      references: references.length, sourcePages: pages.length,
      reconciliationStatuses: statuses,
      withPurchasePrice: references.filter(r=>r.purchasePriceKnown).length,
      withNumericStock: references.filter(r=>r.stockKnown).length,
      withFreshSourceReading: references.filter(r=>r.sourceFresh).length,
      createAllowed: 0,
    },
    pages,
    warnings: [
      "Une URL source commune est un candidat regroupement, pas une preuve de variantes.",
      "Les prix, stocks et dates des brouillons ne sont pas une verification fournisseur en direct.",
      "L import, la classification et la publication sont desactives dans V33.",
    ],
  };
}
