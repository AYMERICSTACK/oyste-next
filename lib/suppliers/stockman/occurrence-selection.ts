import type { StockmanDiscoveredReference } from "./catalog-scanner";
import { stockmanUrlLanguage } from "./url";

const PRIMARY_RELATIONS = new Set(["PRIMARY", "PRIMARY_VARIANT"]);
const SECONDARY_RELATIONS = new Set([
  "ACCESSORY",
  "OPTION",
  "SPARE_PART",
  "RELATED_PRODUCT",
  "RECOMMENDED_PRODUCT",
]);

function evidenceRank(item: StockmanDiscoveredReference): number {
  if (SECONDARY_RELATIONS.has(item.relationType)) {
    return item.classificationConfidence === "EXPLICIT" ? 50 : 40;
  }

  if (PRIMARY_RELATIONS.has(item.relationType)) {
    return item.classificationConfidence === "UNKNOWN" ? 10 : 30;
  }

  return item.classificationConfidence === "UNKNOWN" ? 10 : 20;
}

export function selectBestStockmanOccurrence(
  current: StockmanDiscoveredReference | undefined,
  candidate: StockmanDiscoveredReference,
): StockmanDiscoveredReference {
  if (!current) return candidate;

  // Ne jamais remplacer une classification explicite d'accessoire,
  // d'option ou de piece detachee par une variante principale.
  const currentRank = evidenceRank(current);
  const candidateRank = evidenceRank(candidate);

  if (candidateRank > currentRank) return candidate;
  if (candidateRank < currentRank) return current;

  const currentFrench = stockmanUrlLanguage(current.sourceUrl) === "fr";
  const candidateFrench = stockmanUrlLanguage(candidate.sourceUrl) === "fr";

  if (candidateFrench && !currentFrench) return candidate;
  return current;
}
