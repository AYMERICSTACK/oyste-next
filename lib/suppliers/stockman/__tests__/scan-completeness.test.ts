import assert from "node:assert/strict";
import test from "node:test";
import { hasProvenCompleteStockmanScan } from "../scan-completeness";

const complete = {
  scanComplete: true,
  browseLimitReached: false,
  productLimitReached: false,
  queueLimitReached: false,
  discardedUrls: 0,
  unvisitedUrls: 0,
  navigationErrors: 0,
  productErrors: 0,
};

test("autorise la réconciliation destructive uniquement après preuve complète", () => {
  assert.equal(hasProvenCompleteStockmanScan(complete), true);
  assert.equal(hasProvenCompleteStockmanScan({ ...complete, scanComplete: undefined }), false);
  assert.equal(hasProvenCompleteStockmanScan({ ...complete, queueLimitReached: true }), false);
  assert.equal(hasProvenCompleteStockmanScan({ ...complete, discardedUrls: 1 }), false);
  assert.equal(hasProvenCompleteStockmanScan({ ...complete, unvisitedUrls: 1 }), false);
  assert.equal(hasProvenCompleteStockmanScan({ ...complete, navigationErrors: 1 }), false);
  assert.equal(hasProvenCompleteStockmanScan({ ...complete, productErrors: 1 }), false);
});
