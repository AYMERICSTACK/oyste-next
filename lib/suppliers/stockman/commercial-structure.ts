import { classifyCommercialRow, type StockmanCommercialRowSnapshot, type StockmanRelationType } from "./page-structure";

/**
 * Read-only commercial structure evidence. This is a planning aid, NOT an
 * authorization to create a Product, a variant or an order in Neon.
 *
 * STOCKMAN taxonomy is navigation; a row-local ACCESSOIRE badge is a product
 * relationship; multiple commercial references are not automatically variants.
 */
export type StockmanCommercialStructure = {
  kind: "ACCESSORY_REFERENCES_REVIEW" | "MULTI_REFERENCE_FAMILY_REVIEW" | "SINGLE_REFERENCE_REVIEW" | "NO_REFERENCES";
  sellableReferenceCandidates: string[];
  accessoryReferences: string[];
  otherReferences: string[];
  candidateVariantReferences: string[];
  requiresManualReview: true;
  automatedImportAllowed: false;
  evidence: string[];
};

type Row = Pick<StockmanCommercialRowSnapshot, "reference" | "badgeTexts" | "sectionLabels" | "text" | "description" | "optionImageEvidence" | "isCommercialTable" | "isPrimaryFamilyTable" | "ancestorClass" | "dataAttributes" | "rowIndex">;

export function analyzeStockmanCommercialStructure(
  rows: readonly Row[],
  context: { familyReference: string | null; breadcrumb: string[] },
): StockmanCommercialStructure {
  const referenceRelations = new Map<string, StockmanRelationType>();
  const evidence: string[] = [];
  for (const row of rows) {
    const reference = row.reference.trim().toUpperCase();
    if (!row.isCommercialTable || !/^[A-Z0-9][A-Z0-9./_-]{1,30}$/.test(reference)) continue;
    const classification = classifyCommercialRow(row as StockmanCommercialRowSnapshot, context);
    // If one reference appears repeatedly, explicit secondary evidence has priority.
    const previous = referenceRelations.get(reference);
    const secondary = new Set<StockmanRelationType>(["ACCESSORY", "OPTION", "SPARE_PART"]);
    if (!previous || secondary.has(classification.relationType) || !secondary.has(previous)) {
      referenceRelations.set(reference, classification.relationType);
    }
    if (classification.confidence === "EXPLICIT") evidence.push(`${reference}: ${classification.evidence.join(", ")}`);
  }
  const entries = [...referenceRelations];
  const accessoryReferences = entries.filter(([, relation]) => relation === "ACCESSORY").map(([ref]) => ref);
  const otherReferences = entries.filter(([, relation]) => relation !== "ACCESSORY").map(([ref]) => ref);
  // A family-page grouping is not a proved parent/variant relation; it must
  // remain a review candidate, including for LM-B100, LM-B300, etc.
  const candidateVariantReferences = entries.length > 1 && accessoryReferences.length === 0
    ? entries.filter(([, relation]) => relation !== "OPTION" && relation !== "SPARE_PART").map(([ref]) => ref)
    : [];
  const kind = entries.length === 0 ? "NO_REFERENCES"
    : accessoryReferences.length > 0 ? "ACCESSORY_REFERENCES_REVIEW"
    : entries.length > 1 ? "MULTI_REFERENCE_FAMILY_REVIEW"
    : "SINGLE_REFERENCE_REVIEW";
  return {
    kind,
    sellableReferenceCandidates: entries.filter(([, relation]) => relation !== "SPARE_PART" && relation !== "OPTION").map(([ref]) => ref),
    accessoryReferences,
    otherReferences,
    candidateVariantReferences,
    requiresManualReview: true,
    automatedImportAllowed: false,
    evidence,
  };
}
