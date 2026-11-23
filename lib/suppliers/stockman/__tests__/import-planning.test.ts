import test from "node:test";
import assert from "node:assert/strict";
import { planStockmanReferences, summarizeStockmanPlanning, type StockmanPlanningReference } from "../import-planning";
const base = (overrides: Partial<StockmanPlanningReference>): StockmanPlanningReference => ({
  reference: "S2T", designation: "Servante", category: "Diables et chariots", sourceUrl: "https://www.stockman.fr/s2t.aspx", isActive: true,
  targetId: null, productId: null, lastMatchStatus: null, ...overrides,
});
test("une liaison durable prevaut et ne provoque aucun nouvel import", () => {
  const [row] = planStockmanReferences([base({ targetId: "existing-variant" })], []);
  assert.equal(row.state, "ALREADY_LINKED"); assert.equal(row.autoImportAllowed, false);
});
test("un brouillon ne prouve ni stock frais ni regroupement en variantes", () => {
  const [row] = planStockmanReferences([base({ reference: "LM-B100", category: "Levage magnetique" })], [{ reference: "lm-b100", status: "PREPARED", sourceReadAt: null, purchasePriceExVat: null, stock: null }]);
  assert.equal(row.state, "PREPARED_DRAFT"); assert.equal(row.hasPurchasePrice, false); assert.equal(row.hasNumericStock, false); assert.equal(row.autoImportAllowed, false);
});
test("un badge accessoire ne peut etre invente depuis la navigation", () => {
  const [row] = planStockmanReferences([base({ reference: "A-1-00026", category: "Options et accessoires diables" })], []);
  assert.equal(row.commercialHint, "ACCESSORY_PATH_REVIEW"); assert.equal(row.state, "SOURCE_REVIEW");
});
test("une reference inactive reste inactive meme si elle a un brouillon", () => {
  const [row] = planStockmanReferences([base({ reference: "OLD", isActive: false })], [{ reference: "OLD", status: "PREPARED", sourceReadAt: null, purchasePriceExVat: 10, stock: 4 }]);
  assert.equal(row.state, "INACTIVE");
});
test("les totaux par categorie ne comptent pas plusieurs fois une reference", () => {
  const rows = planStockmanReferences([base({ reference: "A", targetId: "id" }), base({ reference: "B" })], []);
  const result = summarizeStockmanPlanning(rows);
  assert.equal(result.totals.all, 2); assert.equal(result.totals.ALREADY_LINKED, 1); assert.equal(result.families[0].total, 2);
});
