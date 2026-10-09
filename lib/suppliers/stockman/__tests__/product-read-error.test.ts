import assert from "node:assert/strict";
import test from "node:test";
import {
  assertStockmanDocumentStatus,
  classifyStockmanProductReadError,
  StockmanProductReadError,
  stockmanPreparationHttpStatus,
} from "../product-read-error";

test("une réponse STOCKMAN 500 devient immédiatement une indisponibilité fournisseur", () => {
  assert.throws(
    () => assertStockmanDocumentStatus(500),
    (error) => error instanceof StockmanProductReadError
      && error.kind === "supplier_unavailable"
      && /HTTP 500/.test(error.message),
  );
});

test("une 404 reste une erreur locale de fiche", () => {
  assert.throws(
    () => assertStockmanDocumentStatus(404),
    (error) => error instanceof StockmanProductReadError && error.kind === "invalid_source",
  );
});

test("une lecture valide n'est pas rejetée", () => {
  assert.doesNotThrow(() => assertStockmanDocumentStatus(200));
});

test("la classification conserve une erreur fournisseur structurée", () => {
  assert.deepEqual(
    classifyStockmanProductReadError(new StockmanProductReadError("indisponible", "supplier_unavailable")),
    { error: "indisponible", errorKind: "supplier_unavailable" },
  );
});

test("zéro brouillon avec panne fournisseur ne peut plus être renvoyé HTTP 200", () => {
  assert.equal(stockmanPreparationHttpStatus({ prepared: 0, errors: [{ errorKind: "supplier_unavailable" }] }), 503);
  assert.equal(stockmanPreparationHttpStatus({ prepared: 0, errors: [{ errorKind: "product_read" }] }), 422);
  assert.equal(stockmanPreparationHttpStatus({ prepared: 1, errors: [{ errorKind: "supplier_unavailable" }] }), 200);
});
