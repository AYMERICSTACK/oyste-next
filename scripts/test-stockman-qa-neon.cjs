const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const Module = require('node:module');
const ts = require('typescript');

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) {
  const resolved = name.startsWith('@/') ? path.resolve(name.slice(2))
    : name === 'server-only' ? 'next/dist/compiled/server-only/empty' : name;
  return originalResolve.call(this, resolved, ...args);
};
require.extensions['.ts'] = (module, filename) => {
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  });
  module._compile(code.outputText, filename);
};

async function run() {
  assert(process.env.VERCEL_ENV === 'preview' && process.env.OYSTE_STOCKMAN_TEST === 'true'
    && process.env.VERCEL_GIT_COMMIT_REF === 'recette-stockman-isolee', 'Recette isolée uniquement');
  const { prisma } = require('../lib/db/prisma.ts');
  try {
    const [{ environment }] = await prisma.$queryRaw`SELECT environment FROM "OysteQaMarker"`;
    assert.equal(environment, 'recette-stockman-isolee');
    const { getSharedStockmanScope } = require('../lib/suppliers/stockman/shared-commercial-scope.ts');
    const { applyNextScheduledStockmanSync } = require('../lib/suppliers/stockman/scheduled-commercial-sync.ts');
    const { planGlobal } = require('../lib/suppliers/stockman/global-import/planner.ts');
    const { createDraftGroup } = require('../lib/suppliers/stockman/global-import/writer.ts');
    const { keys, exclusions } = await getSharedStockmanScope();
    assert.equal(keys.length, 10);
    const { id: supplierId } = await prisma.supplier.findUniqueOrThrow({ where: { slug: 'stockman' } });
    const { id: categoryId } = await prisma.category.findUniqueOrThrow({ where: { slug: 'qa-recette-oyste' } });
    const reference = 'QASYNCM1';
    const before = { code: reference, name: 'Synchronisation fictive STOCKMAN', slug: 'qa-stockman-sync', supplierId,
      stock: 4, priceHt: 99, sourceData: { stockman: { reference, purchasePriceExVat: 80 } } };
    await prisma.product.upsert({ where: { id: 'qa-stockman-sync' }, create: { id: 'qa-stockman-sync', ...before }, update: before });
    await prisma.$executeRaw`INSERT INTO "StockmanSalePrice" (reference,"priceHt","sourceVersion","sourceSha256")
      VALUES (${reference},90,'RECETTE','qa-synthetic') ON CONFLICT (reference) DO NOTHING`;

    const id = `qa-build-${randomUUID()}`;
    const now = new Date();
    const sourceUrl = 'https://www.stockman.fr/fr/transpalettes--17/transpalettes-manuels--110/--1/fiche-fictive-recette--QA.aspx';
    const options = { scheduledCommercialRead: true, commercialScope: keys, excludedReferences: exclusions };
    const refs = [reference, ...Array.from({ length: 16 }, (_, i) => `QANEW${i.toString().padStart(2, '0')}`)];
    const jobData = { phase: 'FINISHED', progress: {}, options, finishedAt: now };
    const report = { keys, excluded: exclusions, pricesAndStocks: refs.map(reference => ({ reference })) };
    await prisma.stockmanDiscoveryJob.create({ data: { ...jobData, id: `${id}-partial`, status: 'PARTIAL',
      result: { diagnostics: { scanComplete: false }, commercialScope: report } } });
    process.env.STOCKMAN_SCHEDULED_COMMERCIAL_SYNC = 'true';
    try {
      assert(await applyNextScheduledStockmanSync(now));
      assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: 'qa-stockman-sync' } })).stock, 4);
      const completedAt = new Date(now.getTime() + 1);
      await prisma.stockmanDiscoveryJob.create({ data: { ...jobData, id, finishedAt: completedAt, status: 'COMPLETE',
        result: { diagnostics: { scanComplete: true }, commercialScope: report } } });
      await prisma.stockmanDiscoveryResult.createMany({ data: refs.map((reference, i) => ({
        jobId: id, occurrenceKey: `${id}-${i}`, reference, sourceUrl, relationType: 'PRIMARY',
        payload: { reference, sourceUrl, relationType: 'PRIMARY', readAt: now.toISOString(), classificationConfidence: 'STRUCTURAL',
          classificationEvidence: ['commercial-table'], supplierData: { purchasePriceExVat: 100, purchasePriceUnit: 'UNIT_HT', priceState: 'NUMERIC', stock: 9, stockState: 'NUMERIC' } },
      })) });
      assert(await applyNextScheduledStockmanSync(completedAt));
      assert(await applyNextScheduledStockmanSync(completedAt));
      assert.equal(await applyNextScheduledStockmanSync(completedAt), false);
      const product = await prisma.product.findUniqueOrThrow({ where: { id: 'qa-stockman-sync' } });
      const [sale] = await prisma.$queryRaw`SELECT "priceHt" FROM "StockmanSalePrice" WHERE reference = ${reference}`;
      const audit = await prisma.auditLog.findMany({ where: { entityId: id } });
      assert.equal(product.stock, 9);
      assert.equal(product.sourceData.stockman.purchasePriceExVat, 100);
      assert.equal(Number(product.priceHt), 99);
      assert.equal(Number(sale.priceHt), 90);
      assert.equal(audit.length, 2);
      assert(audit.flatMap(row => row.metadata.entries).some(e => e.reference === reference && e.anomalies.includes('MARGE_NEGATIVE')));
      console.log('STOCKMAN QA: partial scan ignored; resumed after the first batch; purchase, stock and margin verified; both sales prices preserved');
    } finally {
      delete process.env.STOCKMAN_SCHEDULED_COMMERCIAL_SYNC;
    }

    const specs = [['QA-DRAFT-SN', ['SN15A', 'SN15B']], ['QA-DRAFT-SF', ['SF10', 'SF20']]];
    const refsForDrafts = specs.flatMap(([, refs]) => refs);
    const catalogue = require('../data/stockman/catalogue-produits.json').products.filter(p => refsForDrafts.includes(p.reference));
    assert.equal(catalogue.length, 4);
    const prices = new Map(refsForDrafts.map((code, index) => [code, 120 + index]));
    const groups = specs.map(([key, references]) => ({ key, categoryId, name: `Famille fictive de recette ${key}`,
      products: references.map(reference => ({ reference, name: `Variante fictive ${reference}`, images: [], documents: [], features: [],
        stock: 3, weightKg: 50, readAt: now.toISOString(), sourceUrl })) }));
    await prisma.$transaction(async tx => {
      for (const group of groups) {
        const id = group.key.toLowerCase();
        const parent = await tx.product.findUnique({ where: { id }, include: { variants: true } })
          ?? await createDraftGroup(tx, group, supplierId, prices, 'STOCKMAN-QA-ONLY', id);
        assert.equal(parent.publicationStatus, 'DRAFT');
        assert.deepEqual(parent.variants.map(v => v.code).sort(), group.products.map(p => p.reference).sort());
        for (const variant of parent.variants) assert.equal(Number(variant.priceHt), prices.get(variant.code));
      }
    });
    const existing = await prisma.productVariant.findMany({ where: { code: { in: refsForDrafts } }, include: { product: true } });
    assert.equal(existing.length, 4);
    const replay = planGlobal(catalogue, { supplierId, active: refsForDrafts, prices, categories: [], drafts: [], evidence: [],
      existing: existing.map(v => ({ kind: 'variant', id: v.id, productId: v.productId, references: [v.code], supplierId, publicationStatus: v.product.publicationStatus })) });
    assert.equal(replay.existing, 4);
    assert.equal(replay.groups.length, 0);
    console.log('STOCKMAN QA: two draft parents and four variants saved on isolated Neon; replay found four existing variants and no new group');
  } finally {
    await globalThis.__stockmanSalePricePool?.end();
    await prisma.$disconnect();
  }
}

run().catch(error => {
  console.error('STOCKMAN QA Neon scenario failed:', error.code || error.name, error.stack?.split('\n').find(line => /test-stockman-qa-neon\.cjs:\d+/.test(line))?.trim());
  process.exitCode = 1;
});
