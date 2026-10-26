import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { matchStockmanCatalogReference } from "../equivalence-engine";
import type { StockmanMatchCandidate } from "../equivalence-engine";
import type { StockmanDiscoveredReference } from "../catalog-scanner";

function candidate(
  type: "product" | "variant",
  targetId: string,
  productId: string,
  supplierCode = "TEST-100",
): StockmanMatchCandidate {
  return {
    targetType: type,
    targetId,
    productId,
    targetName: `Test ${type}`,
    supplierCode,
    sourceData: {},
  };
}

const item: StockmanDiscoveredReference = {
  reference: "TEST-100",
  designation: "Produit de test",
  sourceUrl: "https://example.com/test",
  category: "Test",
  subcategory: null,
  familyReference: null,
  familyTitle: null,
  relationType: "UNKNOWN",
  classificationConfidence: "UNKNOWN",
  classificationEvidence: [],
};

describe("STOCKMAN parent / variante", () => {
  it("privilegie la variante unique du parent", () => {
    const result = matchStockmanCatalogReference(item, [
      candidate("product", "P1", "P1"),
      candidate("variant", "V1", "P1"),
    ]);

    assert.equal(result.status, "matched");
    assert.equal(result.targetType, "variant");
    assert.equal(result.targetId, "V1");
    assert.equal(result.productId, "P1");
  });

  it("conserve une variante seule", () => {
    const result = matchStockmanCatalogReference(item, [
      candidate("variant", "V1", "P1"),
    ]);

    assert.equal(result.status, "matched");
    assert.equal(result.targetId, "V1");
  });

  it("conserve l'ambiguite entre deux variantes", () => {
    const result = matchStockmanCatalogReference(item, [
      candidate("variant", "V1", "P1"),
      candidate("variant", "V2", "P1"),
    ]);

    assert.equal(result.status, "ambiguous");
  });

  it("conserve l'ambiguite entre deux produits", () => {
    const result = matchStockmanCatalogReference(item, [
      candidate("product", "P1", "P1"),
      candidate("product", "P2", "P2"),
    ]);

    assert.equal(result.status, "ambiguous");
  });

  it("refuse un parent et une variante de produits differents", () => {
    const result = matchStockmanCatalogReference(item, [
      candidate("product", "P1", "P1"),
      candidate("variant", "V2", "P2"),
    ]);

    assert.equal(result.status, "ambiguous");
  });

  it("fonctionne aussi avec une reference normalisee", () => {
    const normalizedItem = { ...item, reference: "TEST100" };
    const result = matchStockmanCatalogReference(normalizedItem, [
      candidate("product", "P1", "P1"),
      candidate("variant", "V1", "P1"),
    ]);

    assert.equal(result.status, "matched");
    assert.equal(result.targetType, "variant");
  });
});
