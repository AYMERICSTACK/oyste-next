import test from "node:test";
import assert from "node:assert/strict";
import { buildLiftTableBatchV33 } from "../lift-table-batch-v33";
import type { ReconciliationRow } from "../catalog-reconciliation";

const base = (reference: string, url: string, status = "SOURCE_REVIEW") => ({
  reference, designation: "Table elevatrice", category: "tables elevatrices / tables elevatrices manuelles",
  categoryEvidence: "SOURCE_URL", rawIndexCategory: ">", referenceQuality: "UNVERIFIED", sourceUrl: url,
  state: "SOURCE_REVIEW", commercialHint: "UNCLASSIFIED_REVIEW", hasCommercialDraft: false,
  hasPurchasePrice: false, hasNumericStock: false, sourceReadAt: null, autoImportAllowed: false,
  reconciliationStatus: status, matchingProductIds: [], matchingVariantIds: [], matchingMethods: [],
  reconciliationNotes: [],
}) as ReconciliationRow;
const url = "https://www.stockman.fr/tables-elevatrices--16/tables-elevatrices-manuelles--97/--1/table--X.aspx";
const now = new Date("2026-11-23T12:00:00.000Z");

test("same source page groups references but does not validate variants", () => {
  const result = buildLiftTableBatchV33([base("A", url), base("B", url + "?src=int")], [], now);
  assert.equal(result.summary.references, 2);
  assert.equal(result.summary.sourcePages, 1);
  assert.equal(result.pages[0].grouping, "SOURCE_PAGE_CANDIDATE_NOT_VALIDATED_VARIANTS");
  assert.equal(result.pages[0].createAllowed, false);
});
test("existing products and ambiguous matches remain blocked", () => {
  const result = buildLiftTableBatchV33([base("A", url, "CONFIRMED_IN_OYSTE"), base("B", url, "AMBIGUOUS_MATCH")], [], now);
  assert.ok(result.pages[0].references[0].blockers.includes("RECONCILIATION_CONFIRMED_IN_OYSTE"));
  assert.ok(result.pages[0].references[1].blockers.includes("RECONCILIATION_AMBIGUOUS_MATCH"));
});
test("draft prices and numeric stock are distinct evidence", () => {
  const result = buildLiftTableBatchV33([base("A",url)], [
    { reference: "A", status: "PREPARED", purchasePriceExVat: "420.00", stock: null, sourceReadAt: now },
  ], now);
  assert.equal(result.summary.withPurchasePrice, 1);
  assert.equal(result.summary.withNumericStock, 0);
  assert.equal(result.summary.createAllowed, 0);
});
test("stale dates cannot be passed off as fresh", () => {
  const result = buildLiftTableBatchV33([base("A",url)], [
    { reference: "A", status: "PREPARED", purchasePriceExVat: 420, stock: 7,
      sourceReadAt: new Date("2026-09-01") },
  ], now);
  assert.equal(result.summary.withFreshSourceReading, 0);
  assert.ok(result.pages[0].references[0].blockers.includes("SOURCE_READING_STALE"));
});
test("non-target supplier families excluded", () => {
  const row = base("A",url);
  row.category = "transpalettes / transpalettes manuels";
  assert.equal(buildLiftTableBatchV33([row], [], now).summary.references, 0);
});
test("even complete source drafts never grant automated creation", () => {
  const result = buildLiftTableBatchV33([base("A",url)], [
    { reference: "A", status: "PREPARED", purchasePriceExVat: 420, stock: 7, sourceReadAt: now },
  ], now);
  assert.equal(result.summary.createAllowed, 0);
  assert.ok(result.pages[0].references[0].blockers.includes("SALE_PRICE_AND_FREIGHT_UNVALIDATED"));
});
