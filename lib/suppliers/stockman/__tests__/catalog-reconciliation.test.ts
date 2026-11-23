import assert from "node:assert/strict";
import test from "node:test";
import { reconcileStockmanCatalog, summarizeStockmanReconciliation } from "../catalog-reconciliation";

const ref = (reference: string, partial: Record<string, unknown> = {}) => ({
  reference, designation: "Article", category: ">",
  sourceUrl: "https://www.stockman.fr/tables-elevatrices--16/tables-elevatrices-manuelles--97/--1/article--BAL100.aspx",
  isActive: true, targetId: null, productId: null, lastMatchStatus: null, ...partial,
});
const product = (id: string, code: string) => ({ id, code, supplierCode: code, publicationStatus: "DRAFT", sourceData: null });
const variant = (id: string, productId: string, code: string) => ({ id, productId, code, supplierCode: code, sourceData: null });
const run = (references: any[], products: any[] = [], variants: any[] = [], drafts: any[] = []) =>
  reconcileStockmanCatalog(references, drafts, products, variants);

test("AF2436 deja cree en variante OYSTE ne devient pas un nouveau produit", () => {
  const [row] = run([ref("AF2436")], [product("p1", "STOCKMAN-AF")], [variant("v1", "p1", "AF2436")]);
  assert.equal(row.reconciliationStatus, "CONFIRMED_IN_OYSTE");
  assert.deepEqual(row.matchingProductIds, ["p1"]);
  assert.deepEqual(row.matchingVariantIds, ["v1"]);
  assert.equal(row.autoImportAllowed, false);
});
test("une liaison d index non prouvee n est pas une correspondance catalogue", () => {
  const [row] = run([ref("A-1-00026", { productId: "p-old" })]);
  assert.equal(row.reconciliationStatus, "INDEX_LINK_UNVERIFIED");
});
test("un brouillon commercial non importe ne vaut pas un produit", () => {
  const [row] = run([ref("BAL100")], [], [], [{ reference: "BAL100", status: "PREPARED", sourceReadAt: null, purchasePriceExVat: 100, stock: 8 }]);
  assert.equal(row.reconciliationStatus, "DRAFT_NO_PRODUCT");
});
test("plusieurs entites portent le meme code: ambiguite bloquante", () => {
  const [row] = run([ref("LM-B100")], [product("p1", "LM-B100"), product("p2", "LM-B100")]);
  assert.equal(row.reconciliationStatus, "AMBIGUOUS_MATCH");
});
test("une reference inactive reste inactive, meme si une variante existe", () => {
  const [row] = run([ref("X10", { isActive: false })], [], [variant("v10", "p10", "X10")]);
  assert.equal(row.reconciliationStatus, "INACTIVE");
  assert.ok(row.reconciliationNotes.includes("INACTIVE_BUT_PRODUCT_EXISTS"));
});
test("les metadonnees STOCKMAN reference sont rapprochees sans supposer les variantes", () => {
  const [row] = run([ref("AT90")], [], [{ id: "v", productId: "p", code: "CUSTOM", supplierCode: null, sourceData: { stockman: { reference: "AT90" } } }]);
  assert.equal(row.reconciliationStatus, "CONFIRMED_IN_OYSTE");
  assert.ok(row.matchingMethods.includes("variant.sourceData.stockman.reference"));
});
test("l index contradictoire est bloque", () => {
  const [row] = run([ref("AF2436", { productId: "another" })], [], [variant("v", "p", "AF2436")]);
  assert.equal(row.reconciliationStatus, "AMBIGUOUS_MATCH");
});
test("une reference libre sans brouillon reste a verifier", () => {
  const rows = run([ref("BAL100"), ref("AF2436")], [], [variant("v", "p", "AF2436")]);
  const summary = summarizeStockmanReconciliation(rows);
  assert.equal(summary.totals.SOURCE_REVIEW, 1);
  assert.equal(summary.totals.CONFIRMED_IN_OYSTE, 1);
  assert.equal(summary.totals.all, 2);
});
