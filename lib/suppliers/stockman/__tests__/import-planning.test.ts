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

test("les 2 niveaux de la vraie URL STOCKMAN remplacent la categorie brute >", async () => {
  const { supplierFamilyFromUrl } = await import("../import-planning");
  const url = "https://www.stockman.fr/transpalettes--17/transpalettes-manuels--110/--1/transpalette-manuel-3000-kg--AC30.aspx";
  assert.equal(supplierFamilyFromUrl(url), "transpalettes / transpalettes manuels");
  const [row] = planStockmanReferences([base({ category: ">", sourceUrl: url })], []);
  assert.equal(row.category, "transpalettes / transpalettes manuels");
  assert.equal(row.categoryEvidence, "SOURCE_URL");
  assert.equal(row.rawIndexCategory, ">");
});
test("une categorie brute de type fiche HTML n est pas une famille", () => {
  const [row] = planStockmanReferences([base({ category: "LP\n Elevateur leve charge\n Plus d'infos ici", sourceUrl: "https://www.stockman.fr/bad.aspx" })], []);
  assert.equal(row.category, "Famille fournisseur a verifier");
  assert.equal(row.categoryEvidence, "UNKNOWN");
});
test("les pseudo references date et tension sont signalees sans suppression", async () => {
  const { referenceLooksSuspicious } = await import("../import-planning");
  assert.equal(referenceLooksSuspicious("18/09/2026"), true);
  assert.equal(referenceLooksSuspicious("220V."), true);
  assert.equal(referenceLooksSuspicious("48V/20"), true);
  assert.equal(referenceLooksSuspicious("AC30"), false);
  const rows = planStockmanReferences([base({ reference: "18/09/2026" }), base({ reference: "AC30" })], []);
  const summary = summarizeStockmanPlanning(rows);
  assert.equal(summary.totals.all, 2);
  assert.equal(summary.quality.suspectReferences, 1);
});
