import assert from "node:assert/strict";
import { test } from "node:test";
import type { Inventory } from "../global-import/planner";

test("Stockman maintenance validates authorized structure, freshness, price and margin", async () => {
  process.env.DATABASE_URL ??= "postgresql://offline:offline@127.0.0.1:1/offline";
  const { maintenanceDigest, maintenanceManifest, planMaintenance } = await import("../global-import/maintenance");
  const { SCOPE_VERSION } = await import("../global-import/scope");
  const at = Date.parse("2026-11-27T09:00:00Z");
  const sourceUrl = "https://www.stockman.fr/fr/famille--BAL100.aspx";
  const raw = {
    scopeVersion: SCOPE_VERSION,
    families: [{
      familyCode: "BAL100", name: "Table élévatrice", approvedCategoryId: "cat", sourceUrl,
      verifiedAt: new Date(at).toISOString(),
      products: [{
        reference: "BAL100", name: "Table élévatrice", sourceUrl, images: [], documents: [],
        features: [], weightKg: 23, expectedSaleHT: 125,
        purchaseObservation: { amountHT: 100, readAt: new Date(at).toISOString() },
      }],
      excluded: [{ reference: "BAL100-OPTION", role: "OPTION", evidence: "Accessoire distinct sur le tableau fournisseur" }],
    }],
    registry: [{ formerReference: "OLD-BAL", successorReference: null, sourceUrl: null,
      family: "BAL100", category: "Table", observedAt: null, evidence: "Ancien code", oysteReference: null }],
  };
  const manifest = maintenanceManifest.parse(raw);
  const state: Inventory = {
    supplierId: "supplier", drafts: [], active: ["BAL100"], prices: new Map([["BAL100", 125]]),
    categories: [{ id: "cat", name: "Table", slug: "table", path: null, parentId: null, isActive: true, catalogueVisible: true }],
    existing: [], evidence: [],
  };
  const check = (fn: () => unknown, code: string) => assert.throws(fn, { code });
  assert.equal(maintenanceDigest({a: 1, b: 2}), maintenanceDigest({b: 2, a: 1}));
  const plan = planMaintenance(manifest, state, at);
  assert.deepEqual(plan.references, ["BAL100"]);
  assert.equal(plan.excluded, 1);
  assert.equal(plan.evidence[0].products[0].stock, null);
  check(() => planMaintenance(manifest, state, at + 86_400_000), "STALE_PURCHASE_OBSERVATION");
  check(() => planMaintenance(manifest, { ...state, replacementHolds: new Set(["BAL100"]) }, at), "MANIFEST_REFERENCE_BLOCKED");
  check(() => planMaintenance(manifest, { ...state, prices: new Map([["BAL100", 124]]) }, at), "SALE_PRICE_CHANGED");
  const low = structuredClone(manifest);
  low.families[0].products[0].purchaseObservation.amountHT = 101;
  check(() => planMaintenance(low, state, at), "MARGIN_BELOW_REFERENCE");
  const wrong = structuredClone(manifest);
  wrong.families[0].products[0].reference = "BAL100-OPTION";
  check(() => planMaintenance(wrong, state, at), "MANIFEST_REFERENCE_BLOCKED");
  wrong.families[0].products[0].reference = "OUTSIDE";
  check(() => planMaintenance(wrong, state, at), "MANIFEST_REFERENCE_BLOCKED");
  const mismatch = structuredClone(manifest);
  mismatch.families[0].products[0].sourceUrl = "https://www.stockman.fr/fr/autre--BAL100.aspx";
  check(() => planMaintenance(mismatch, state, at), "SUPPLIER_EVIDENCE_MISMATCH");
  check(() => planMaintenance(manifest, { ...state, drafts: ["BAL100"] }, at), "MAINTENANCE_PLAN_BLOCKED");
  assert.equal(maintenanceManifest.safeParse({...raw, arbitrary: true}).success, false);
});
