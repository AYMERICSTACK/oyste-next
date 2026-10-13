import assert from "node:assert/strict";
import test from "node:test";
import { selectBestStockmanOccurrence } from "../occurrence-selection";
import type { StockmanDiscoveredReference } from "../catalog-scanner";

function occurrence(
  relationType: StockmanDiscoveredReference["relationType"],
  classificationConfidence: StockmanDiscoveredReference["classificationConfidence"],
  sourceUrl: string,
): StockmanDiscoveredReference {
  return {
    reference: "AC201500",
    designation: "Transpalette",
    sourceUrl,
    category: null,
    subcategory: null,
    familyReference: null,
    familyTitle: null,
    relationType,
    classificationConfidence,
    classificationEvidence: [],
  };
}

test("prefers structural primary evidence over French UNKNOWN", () => {
  const unknown = occurrence("UNKNOWN", "UNKNOWN", "https://www.stockman.fr/example.aspx");
  const structural = occurrence("PRIMARY_VARIANT", "STRUCTURAL", "https://www.stockman.fr/en/example.aspx");

  assert.equal(selectBestStockmanOccurrence(unknown, structural), structural);
});

test("preserves explicit accessory classification over structural primary", () => {
  const accessory = occurrence("ACCESSORY", "EXPLICIT", "https://www.stockman.fr/example.aspx");
  const primary = occurrence("PRIMARY_VARIANT", "STRUCTURAL", "https://www.stockman.fr/en/example.aspx");

  assert.equal(selectBestStockmanOccurrence(accessory, primary), accessory);
});

test("prefers French occurrence when evidence is equal", () => {
  const english = occurrence("UNKNOWN", "UNKNOWN", "https://www.stockman.fr/en/example.aspx");
  const french = occurrence("UNKNOWN", "UNKNOWN", "https://www.stockman.fr/example.aspx");

  assert.equal(selectBestStockmanOccurrence(english, french), french);
});
