import assert from "node:assert/strict";
import test from "node:test";
import { planStockmanCommercialUpdate, type StockmanSyncCandidate } from "../commercial-sync-policy";
import { stockmanUnitPriceEvidence } from "../commercial-evidence";
import { verifiedDatabaseUrl } from "../../../db/verified-database-url";

const now = new Date("2026-11-25T11:00:00Z");
const ref = "FIXTURE1";
const row: StockmanSyncCandidate = {
  reference: ref, sourceUrl: "https://www.stockman.fr/fr/fixture.aspx",
  readAt: "2026-11-25T10:00:00Z", relationType: "PRIMARY_VARIANT", classificationConfidence: "STRUCTURAL",
  classificationEvidence: ["commercial-table"],
  supplierData: { purchasePriceExVat: 100, purchasePriceUnit: "UNIT_HT", priceState: "NUMERIC", stock: 0, stockState: "NUMERIC", barcode: null, weightKg: null },
};
const plan = (observations: StockmanSyncCandidate[], sourceData: unknown = null) =>
  planStockmanCommercialUpdate({ reference: ref, observations, sourceData, shippingMode: "QUOTE", salePriceHT: 119, now });

test("une lecture exacte produit un achat unitaire et conserve la rupture numérique", () => {
  assert.equal(plan([row]).fields.purchasePriceExVat, 100);
  assert.equal(plan([row]).stock, 0);
  assert.equal(plan([row]).margin.grossMarginHT, 19);
});

test("les quantités par lot, les données périmées et les contradictions ne changent pas les valeurs", () => {
  assert.equal(stockmanUnitPriceEvidence("1 050 € HT à l’unité"), true);
  assert.equal(stockmanUnitPriceEvidence("1 050 € HT à l’unité, par carton"), false);
  assert.equal(stockmanUnitPriceEvidence("42 € HT"), false);
  assert.equal(stockmanUnitPriceEvidence("249 € HT à l’unité246 € HT par 3"), true);
  const incorrect = { ...row, supplierData: { ...row.supplierData!, purchasePriceUnit: undefined, priceState: "NUMERIC" as const } };
  assert.equal(plan([incorrect]).fields.purchasePriceExVat, undefined);
  assert.equal(plan([{ ...row, readAt: "2026-11-21T10:00:00Z" }]).stock, undefined);
  assert.equal(plan([{ ...row, sourceUrl: "https://stockman.fr.invalid/fixture.aspx" }]).stock, undefined);
  const other = { ...row, supplierData: { ...row.supplierData!, stock: 4, purchasePriceExVat: 115 } };
  assert.deepEqual(plan([row, other]).anomalies.slice(0, 2), ["ACHATS_CONTRADICTOIRES", "STOCKS_CONTRADICTOIRES"]);
});

test("les états sur demande, l’arrêt et la fraîcheur de chaque donnée sont contrôlés", () => {
  const quote = { ...row, supplierData: { ...row.supplierData!, stock: null, stockState: "RESTOCK" as const, stockAvailabilityText: "Date de réapprovisionnement" } };
  assert.equal(plan([quote]).stock, undefined);
  assert.equal(plan([quote]).fields.stockOnRequest, true);
  assert.equal(plan([{ ...row, commercialText: "Produit arrêté" }]).anomalies[0], "REFERENCE_ARRETEE");
  const prior = { stockman: { purchasePriceExVat: 10, purchaseReadAt: "2026-11-25T10:30:00Z" } };
  assert.equal(plan([row], prior).fields.purchasePriceExVat, undefined);
  assert.equal(plan([row], prior).stock, 0);
  const anomalous = plan([{...row,supplierData:{...row.supplierData!, purchasePriceExVat:200}}], {stockman:{purchasePriceExVat: 10}});
  assert.ok(anomalous.anomalies.includes("ECART_ACHAT_A_VERIFIER"));
  assert.ok(anomalous.anomalies.includes("MARGE_NEGATIVE"));
  assert.equal(anomalous.fields.purchasePriceExVat, undefined);
});

test("Preview refuse un rôle, un hôte de production ou un paramètre de routage inattendu", () => {
  const env = { VERCEL_ENV: "preview", OYSTE_TEST_DB_HOST: "test.example", OYSTE_PRODUCTION_DB_HOST: "production.example",
    OYSTE_TEST_DB_NAME: "oyste_test", OYSTE_TEST_DB_ROLE: "test", DATABASE_URL: "postgresql://test@TEST.example/oyste_test?sslmode=require" };
  assert.equal(verifiedDatabaseUrl(env), env.DATABASE_URL);
  assert.throws(() => verifiedDatabaseUrl({ ...env, DATABASE_URL: "postgresql://test@production-pooler.example/oyste_test" }), /refusée/);
  assert.throws(() => verifiedDatabaseUrl({ ...env, OYSTE_TEST_DB_ROLE: "production" }), /refusée/);
  assert.throws(() => verifiedDatabaseUrl({ ...env, DATABASE_URL: env.DATABASE_URL + "&host=production.example" }), /refusée/);
});
