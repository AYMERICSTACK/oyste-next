import assert from "node:assert/strict";
import test from "node:test";
import type { StockmanCatalogDiscovery } from "../types";
import type { StockmanDiscoveredReference } from "../catalog-scanner";

// Never connect to a database: each operation is replaced by a controlled adapter.
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/never-connect";
const modules = Promise.all([import("@/lib/db/prisma"), import("../living-reference"), import("../discovery-jobs"), import("../catalog-scanner")]);
type PrismaClient = typeof import("@/lib/db/prisma").prisma;

test("occurrences distinctes et données commerciales propres à chaque ligne", async () => {
  const [, , , { extractReferencesFromStructuredRows, deduplicatePageReferences }] = await modules;
  const context = { sourceUrl: "https://www.stockman.fr/item--FAM.aspx", category: "Cat", subcategory: "Sub", familyReference: "FAM", familyTitle: "Famille", breadcrumb: [] };
  const rows = ["PRIMARY", "ACCESSORY"].map((kind, index) => ({ reference: "X123", text: "X123 Produit Poids : 13 kg Stock : 9 Prix Unitaire HT : 146 € HT Code-barres : 1234567890123", badgeTexts: index ? ["ACCESSOIRE"] : [], sectionLabels: [], ancestorClass: "", dataAttributes: [], isCommercialTable: true, isPrimaryFamilyTable: true, rowIndex: index }));
  const references = deduplicatePageReferences(extractReferencesFromStructuredRows(rows, context));
  assert.equal(references.length, 2);
  assert.deepEqual(references.map((item) => item.relationType), ["PRIMARY_VARIANT", "ACCESSORY"]);
  assert.deepEqual(references[0].supplierData, { purchasePriceExVat: 146, stock: 9, weightKg: 13, barcode: "1234567890123" });
});

const completeDiagnostics = { scanComplete: true, browseLimitReached: false, productLimitReached: false, queueLimitReached: false, discardedUrls: 0, unvisitedUrls: 0, navigationErrors: 0, productErrors: 0, productPageFailures: 0, productPageAttempts: 1, uniqueProductUrls: 1, productPagesOpened: 1, browseQueueRemaining: 0 };

test("réconciliation partielle, lots et reprise idempotente sans désactivation", async () => {
  const [, { persistStockmanLivingReference }] = await modules;
  const seenAt = new Date("2026-10-02T08:00:00Z");
  const records = new Map<string, any>([["ABSENT", { reference: "ABSENT", designation: "Absent", category: null, sourceUrl: "url", isActive: true, lastSeenAt: new Date(0) }]]);
  let snapshots = 0, disabled = 0, writes = 0;
  const db = { stockmanCatalogReference: {
    findMany: async () => [...records.values()], deleteMany: async () => ({ count: 0 }),
    upsert: async ({ where, create, update }: any) => {
      writes++;
      const previous = records.get(where.reference);
      if (!previous) records.set(where.reference, create);
      else records.set(where.reference, { ...previous, ...update, seenCount: update.seenCount ? previous.seenCount + 1 : previous.seenCount });
    },
    updateMany: async () => { disabled++; },
  }, stockmanCatalogSnapshot: { create: async () => { snapshots++; } } } as unknown as PrismaClient;
  const discovery = { startedAt: seenAt.toISOString(), finishedAt: seenAt.toISOString(), pagesVisited: 1, productPages: 1,
    diagnostics: { ...completeDiagnostics, scanComplete: false },
    matches: Array.from({ length: 3 }, (_, index) => ({ reference: `ZX${index}`, designation: "Produit", category: null, sourceUrl: "url", status: "missing", matchMethod: "none", confidence: 0 })),
  } as unknown as StockmanCatalogDiscovery;
  await persistStockmanLivingReference(discovery, { db, offset: 0, take: 2, finalize: false });
  assert.equal(writes, 2); assert.equal(snapshots, 0);
  await persistStockmanLivingReference(discovery, { db, offset: 0, take: 2, finalize: false });
  assert.equal(records.get("ZX0").seenCount, 1);
  await persistStockmanLivingReference(discovery, { db, offset: 2, take: 1, finalize: false });
  const stats = await persistStockmanLivingReference(discovery, { db, offset: 3, take: 0, finalize: true });
  assert.equal(disabled, 0); assert.equal(snapshots, 1); assert.equal(stats.disappearanceCheckSkipped, true);
  assert.equal(records.get("ABSENT").isActive, true);
});

test("création atomique réutilise un job compatible, matching et réconciliation reprennent par lots", async (t) => {
  const [{ prisma }, , { startStockmanDiscoveryJob, runNextStockmanDiscoveryBatch }] = await modules;
  const replace = (target: any, key: string, fn: (...args: any[]) => any) => {
    const original = target[key]; target[key] = fn; t.after(() => { target[key] = original; });
  };
  let job: any = null;
  let queueCreates = 0, referenceWrites = 0, snapshots = 0;
  const records = new Map<string, any>();
  const references: StockmanDiscoveredReference[] = Array.from({ length: 105 }, (_, index) => ({ reference: `ZZTEST${String(index).padStart(3, "0")}`, designation: "Fixture commerciale", sourceUrl: "https://www.stockman.fr/test--FAM.aspx", category: null, subcategory: null, familyReference: "FAM", familyTitle: "Famille", relationType: "UNKNOWN", classificationConfidence: "UNKNOWN", classificationEvidence: [] }));
  const apply = (data: any) => { for (const [key, value] of Object.entries(data)) job[key] = value && typeof value === "object" && "increment" in value ? (job[key] ?? 0) + (value as any).increment : value; };
  replace(prisma, "$transaction", async (fn: any) => fn(prisma));
  replace(prisma, "$queryRaw", async () => []);
  replace(prisma.stockmanDiscoveryJob, "findMany", async () => job && ["QUEUED", "RUNNING"].includes(job.status) ? [job] : []);
  replace(prisma.stockmanDiscoveryJob, "create", async ({ data }: any) => { job = { ...data, id: "test-job", status: "QUEUED", phase: "DISCOVERING", createdAt: new Date(), leaseVersion: 0, checkpointVersion: 0 }; return job; });
  replace(prisma.stockmanDiscoveryJob, "findUnique", async () => ({ ...job }));
  replace(prisma.stockmanDiscoveryJob, "findUniqueOrThrow", async () => ({ ...job }));
  replace(prisma.stockmanDiscoveryJob, "findFirst", async () => ({ ...job }));
  replace(prisma.stockmanDiscoveryJob, "updateMany", async ({ data }: any) => { apply(data); return { count: 1 }; });
  replace(prisma.stockmanDiscoveryJob, "update", async ({ data }: any) => { apply(data); return job; });
  replace(prisma.stockmanDiscoveryQueueItem, "create", async () => { queueCreates++; return {}; });
  replace(prisma.stockmanDiscoveryQueueItem, "groupBy", async () => []);
  replace(prisma.stockmanDiscoveryQueueItem, "findMany", async () => [
    { nodeType: "BROWSE", state: "DONE", trace: {}, attempts: 1 },
    { nodeType: "PRODUCT", state: "DONE", attempts: 1, trace: { requestedUrl: "url", finalUrl: "url", extractedReferences: references.map((item) => item.reference), relatedProducts: [] } },
  ]);
  replace(prisma.stockmanDiscoveryResult, "findMany", async () => references.map((payload) => ({ payload })));
  replace(prisma.stockmanDiscoveryResult, "count", async () => references.length);
  replace(prisma.product, "findMany", async () => []);
  replace(prisma.productVariant, "findMany", async () => []);
  replace(prisma.stockmanImportDraft, "findMany", async () => []);
  replace(prisma.stockmanCatalogReference, "findMany", async () => [...records.values()]);
  replace(prisma.stockmanCatalogReference, "deleteMany", async () => ({ count: 0 }));
  replace(prisma.stockmanCatalogReference, "upsert", async ({ create }: any) => { referenceWrites++; records.set(create.reference, create); return create; });
  replace(prisma.stockmanCatalogReference, "updateMany", async () => ({ count: 0 }));
  replace(prisma.stockmanCatalogSnapshot, "create", async () => { snapshots++; return {}; });
  replace(prisma.stockmanCatalogSnapshot, "updateMany", async () => ({ count: 1 }));
  const first = await startStockmanDiscoveryJob({ seedUrl: "http://stockman.fr/fr/" });
  const reused = await startStockmanDiscoveryJob({ seedUrl: "https://www.stockman.fr/" });
  assert.equal(first?.jobId, reused?.jobId); assert.equal(queueCreates, 1);
  job.phase = "MATCHING";
  for (const expected of [50, 100, 105]) {
    assert.equal(await runNextStockmanDiscoveryBatch(job.id), true);
    assert.equal(job.diagnostics.matching.nextIndex, expected);
    assert.equal(job.diagnostics.matching.matches.length, expected);
  }
  assert.equal(await runNextStockmanDiscoveryBatch(job.id), true);
  assert.equal(job.phase, "RECONCILING");
  for (const expected of [50, 100, 105]) {
    assert.equal(await runNextStockmanDiscoveryBatch(job.id), true);
    assert.equal(referenceWrites, expected);
  }
  assert.equal(job.status, "COMPLETE"); assert.equal(job.phase, "FINISHED");
  assert.equal(snapshots, 1); assert.equal(job.result.livingReference.newThisScan, 105);
  assert.equal(await runNextStockmanDiscoveryBatch(job.id), false);
  // A worker whose fence is rejected must not reach supplier writes.
  job.status = "RUNNING"; job.phase = "RECONCILING";
  replace(prisma.stockmanDiscoveryJob, "updateMany", async ({ where, data }: any) => {
    if (where.OR) { apply(data); return { count: 1 }; }
    return { count: 0 };
  });
  assert.equal(await runNextStockmanDiscoveryBatch(job.id), false);
  assert.equal(referenceWrites, 105); assert.equal(snapshots, 1);
});

test("les cellules numériques adjacentes ne sont pas concaténées en faux prix", async () => {
  const [, , , { extractReferencesFromStructuredRows }] = await modules;
  const context = { sourceUrl: "https://www.stockman.fr/item--FAM.aspx", category: null, subcategory: null, familyReference: "FAM", familyTitle: null, breadcrumb: [] };
  const base = { reference: "X123", badgeTexts: [], sectionLabels: [], ancestorClass: "", dataAttributes: [], isCommercialTable: true, rowIndex: 0 };
  assert.equal(extractReferencesFromStructuredRows([{ ...base, text: "X123 Produit Poids : 13 kg 9 146 € HT" }], context)[0].supplierData?.purchasePriceExVat, null);
  assert.equal(extractReferencesFromStructuredRows([{ ...base, text: "X123 Produit Prix Unitaire HT : 1 146,00 € HT" }], context)[0].supplierData?.purchasePriceExVat, 1146);
});
