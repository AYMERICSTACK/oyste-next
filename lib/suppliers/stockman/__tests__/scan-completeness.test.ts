import assert from "node:assert/strict";
import test from "node:test";
import { hasProvenCompleteStockmanScan, stockmanPartialReasons } from "../scan-completeness";

const complete = {
  scanComplete: true,
  browseLimitReached: false,
  productLimitReached: false,
  queueLimitReached: false,
  discardedUrls: 0,
  unvisitedUrls: 0,
  navigationErrors: 0,
  productErrors: 0,
  productPageFailures: 0,
  browseQueueRemaining: 0,
};

test("autorise la réconciliation destructive uniquement après preuve complète", () => {
  assert.equal(hasProvenCompleteStockmanScan(complete), true);
  assert.equal(hasProvenCompleteStockmanScan({ ...complete, scanComplete: undefined }), false);
  assert.equal(hasProvenCompleteStockmanScan({ ...complete, queueLimitReached: true }), false);
  assert.equal(hasProvenCompleteStockmanScan({ ...complete, discardedUrls: 1 }), false);
  assert.equal(hasProvenCompleteStockmanScan({ ...complete, unvisitedUrls: 1 }), false);
  assert.equal(hasProvenCompleteStockmanScan({ ...complete, navigationErrors: 1 }), false);
  assert.equal(hasProvenCompleteStockmanScan({ ...complete, productErrors: 1 }), false);
  assert.equal(hasProvenCompleteStockmanScan({ ...complete, globalIncidentActive: true }), false);
});

test("une preuve incomplète ou un échec produit bloque les disparitions", () => {
  assert.equal(hasProvenCompleteStockmanScan({ scanComplete: true }), false);
  for (const key of ["browseLimitReached", "productLimitReached", "queueLimitReached", "unvisitedUrls", "navigationErrors", "productErrors", "discardedUrls", "productPageFailures", "browseQueueRemaining"] as const) {
    const incomplete = { ...complete, [key]: undefined };
    assert.equal(hasProvenCompleteStockmanScan(incomplete), false, key);
  }
  assert.equal(hasProvenCompleteStockmanScan({ ...complete, productPageFailures: 1 }), false);
  assert.equal(hasProvenCompleteStockmanScan({ ...complete, browseQueueRemaining: 1 }), false);
});

test("les limites, erreurs et queues non épuisées produisent des raisons PARTIAL explicites", () => {
  const reasons = stockmanPartialReasons({
    ...complete,
    scanComplete: false,
    browseLimitReached: true,
    productLimitReached: true,
    queueLimitReached: true,
    discardedUrls: 2,
    unvisitedUrls: 3,
    navigationErrors: 1,
    productErrors: 2,
    productPageFailures: 2,
    browseQueueRemaining: 4,
  });
  assert.equal(reasons.length, 8);
  assert.match(reasons.join(" · "), /Limite de pages browse/);
  assert.match(reasons.join(" · "), /2 erreur\(s\) de fiche produit/);
});

test("un scan certifié complet n'a aucune raison PARTIAL", () => {
  assert.deepEqual(stockmanPartialReasons(complete), []);
});

test("un circuit HTTP 500 ouvert force PARTIAL et bloque la réconciliation destructive", () => {
  const incident = { ...complete, scanComplete: false, globalIncidentActive: true };
  assert.equal(hasProvenCompleteStockmanScan(incident), false);
  assert.match(stockmanPartialReasons(incident).join(" · "), /Incident global HTTP 500/);
});
