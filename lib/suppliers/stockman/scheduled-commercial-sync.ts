import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { isInStockmanCommercialScope } from "./commercial-scope";
import { planStockmanCommercialUpdate, type StockmanSyncCandidate } from "./commercial-sync-policy";
import { stockmanSource } from "./order-policy";
import { parseSharedStockmanScope, stockmanCommercialSetting } from "./shared-commercial-scope";

export const stockmanSyncHistoryType = "StockmanCommercialSync";
const batchAction = "STOCKMAN_COMMERCIAL_SYNC_BATCH";
const batchSize = 16;

const supplier = {
  OR: [{ slug: { equals: "stockman", mode: "insensitive" as const } }, { name: { equals: "stockman", mode: "insensitive" as const } }],
};
const selection = { id: true, code: true, supplierCode: true, stock: true, sourceData: true, shippingMode: true, updatedAt: true } as const;
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const code = (value: string | null) => value?.trim().toUpperCase();

export async function applyNextScheduledStockmanSync(now = new Date()) {
  if (process.env.STOCKMAN_SCHEDULED_COMMERCIAL_SYNC !== "true") return false;
  return prisma.$transaction(async tx => {
    const [lock] = await tx.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_xact_lock(193701, 4) AS locked`;
    if (!lock?.locked) return false;

    const configured = await tx.siteSetting.findUnique({ where: { key: stockmanCommercialSetting }, select: { value: true } });
    if (!configured) return false;
    const { keys, exclusions } = parseSharedStockmanScope(configured.value);
    const job = await tx.stockmanDiscoveryJob.findFirst({ where: {
      status: { in: ["COMPLETE", "PARTIAL", "FAILED", "CANCELLED"] },
      finishedAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000), lte: now },
      AND: [
        { options: { path: ["scheduledCommercialRead"], equals: true } },
        { options: { path: ["commercialScope"], equals: keys } },
        { options: { path: ["excludedReferences"], equals: exclusions } },
      ],
    }, orderBy: [{ finishedAt: "desc" }, { id: "desc" }], select: { id: true, status: true, result: true } });
    if (!job) return false;

    const latest = await tx.auditLog.findFirst({
      where: { action: batchAction, entityType: stockmanSyncHistoryType, entityId: job.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { metadata: true },
    });
    const state = record(latest?.metadata);
    if (state.done === true) return false;
    const start = typeof state.next === "number" && Number.isSafeInteger(state.next) && state.next >= 0 ? state.next : 0;
    const result = record(job.result);
    const report = record(result.commercialScope);
    const verified = job.status === "COMPLETE" && record(result.diagnostics).scanComplete === true
      && JSON.stringify(report.keys) === JSON.stringify(keys) && JSON.stringify(report.excluded) === JSON.stringify(exclusions)
      && Array.isArray(report.pricesAndStocks);
    const available = verified && Array.isArray(report.pricesAndStocks) ? report.pricesAndStocks : [];
    const excluded = new Set(exclusions);
    const references = [...new Set(available.map(row => record(row).reference)
      .filter((value): value is string => typeof value === "string" && /^[A-Z0-9][A-Z0-9./_-]{1,30}$/.test(value) && !excluded.has(value)))].sort();
    const batch = references.slice(start, start + batchSize);
    const entries = [];
    if (batch.length) {
      const identities = { OR: [{ supplierCode: { in: batch, mode: "insensitive" as const } }, { code: { in: batch, mode: "insensitive" as const } }] };
      const [rows, variants, parents, sales, saved] = await Promise.all([
        tx.stockmanDiscoveryResult.findMany({ where: { jobId: job.id, reference: { in: batch } }, select: { reference: true, sourceUrl: true, relationType: true, payload: true },
          orderBy: [{ reference: "asc" }, { sourceUrl: "asc" }, { relationType: "asc" }] }),
        tx.productVariant.findMany({ where: { ...identities, product: { supplier } }, select: { ...selection, productId: true, product: { select: { shippingMode: true } } } }),
        tx.product.findMany({ where: { ...identities, supplier }, select: { ...selection, _count: { select: { variants: true } } } }),
        tx.$queryRaw<Array<{ reference: string; priceHt: Prisma.Decimal }>>`SELECT reference, "priceHt" FROM "StockmanSalePrice" WHERE reference IN (${Prisma.join(batch)})`,
        tx.stockmanCatalogReference.findMany({ where: { reference: { in: batch } }, select: { reference: true, isActive: true } }),
      ]);
      const scanRows = new Map<string, StockmanSyncCandidate[]>();
      for (const row of rows) {
        if (!isInStockmanCommercialScope(row.sourceUrl, keys)) continue;
        const payload = record(row.payload) as unknown as StockmanSyncCandidate;
        if (payload.reference !== row.reference || payload.sourceUrl !== row.sourceUrl || payload.relationType !== row.relationType) continue;
        const existing = scanRows.get(row.reference) ?? [];
        existing.push(payload);
        scanRows.set(row.reference, existing);
      }
      const salePrices = new Map(sales.map(row => [row.reference, Number(row.priceHt)]));
      const active = new Map(saved.map(row => [row.reference, row.isActive]));
      const changedParents = new Set<string>();
      const matches = (row: { code: string; supplierCode: string | null }) => (code(row.supplierCode) || code(row.code));
      for (const reference of batch) {
        const v = variants.filter(row => matches(row) === reference);
        const p = parents.filter(row => matches(row) === reference);
        const variant = v.length === 1 && p.every(parent => parent.id === v[0].productId) ? v[0] : undefined;
        const parent = v.length === 0 && p.length === 1 && p[0]._count.variants === 0 ? p[0] : undefined;
        const target = variant ?? parent;
        const observations = scanRows.get(reference) ?? [];
        const rawSale = salePrices.get(reference);
        const plan = planStockmanCommercialUpdate({ reference, observations, sourceData: target?.sourceData,
          shippingMode: target?.shippingMode ?? variant?.product.shippingMode, salePriceHT: rawSale && rawSale > 0 ? rawSale : null, now });
        const linked = stockmanSource(target?.sourceData).reference;
        const exact = typeof linked !== "string" || !linked.trim() || code(linked) === reference;
        const outcome = !target ? (v.length || p.length ? "CIBLE_AMBIGUE_OU_PARENT_A_VARIANTES" : active.has(reference) ? "CIBLE_OYSTE_ABSENTE" : "NOUVELLE_REFERENCE_A_QUALIFIER")
          : !exact || active.get(reference) === false ? "RATTACHEMENT_A_VERIFIER"
          : !Object.keys(plan.fields).length ? "AUCUNE_MODIFICATION" : "APPLIQUE";
        if (!target || outcome !== "APPLIQUE") {
          entries.push({ reference, outcome, anomalies: plan.anomalies, margin: plan.margin });
          continue;
        }
        const old = stockmanSource(target.sourceData);
        const before = Object.fromEntries(Object.keys(plan.fields).map(key => [key, old[key] ?? null]));
        const sourceData = { ...record(target.sourceData), stockman: { ...old, ...plan.fields } } as Prisma.InputJsonValue;
        const data = { sourceData, ...(plan.stock !== undefined ? { stock: plan.stock } : {}) };
        const where = { id: target.id, updatedAt: target.updatedAt };
        const committed = variant ? await tx.productVariant.updateMany({ where, data }) : await tx.product.updateMany({ where, data });
        if (committed.count !== 1) throw new Error("La cible STOCKMAN a changé pendant la synchronisation.");
        if (variant && "stockReadAt" in plan.fields) changedParents.add(variant.productId);
        entries.push({ reference, outcome, targetId: target.id, targetType: variant ? "variant" : "product",
          before, beforeAbsent: Object.keys(plan.fields).filter(key => !Object.hasOwn(old, key)), after: plan.fields, previousStock: target.stock, nextStock: plan.stock ?? target.stock, anomalies: plan.anomalies, margin: plan.margin });
      }
      for (const parentId of changedParents) {
        const children = await tx.productVariant.findMany({ where: { productId: parentId }, select: { stock: true, sourceData: true } });
        const stock = children.reduce((sum, row) => sum + (stockmanSource(row.sourceData).stockOnRequest === true ? 0 : row.stock), 0);
        if (stock > 2_147_483_647) {
          entries.push({ targetId: parentId, targetType: "product", outcome: "STOCK_PARENT_INCOHERENT" });
          continue;
        }
        const parentBefore = await tx.product.findUniqueOrThrow({ where: { id: parentId }, select: { stock: true } });
        if (parentBefore.stock !== stock) {
          await tx.product.update({ where: { id: parentId }, data: { stock } });
          entries.push({ targetId: parentId, targetType: "product", outcome: "STOCK_PARENT_RECALCULE", previousStock: parentBefore.stock, nextStock: stock });
        }
      }
    }
    const next = start + batch.length;
    await tx.auditLog.create({ data: {
      action: batchAction, entityType: stockmanSyncHistoryType, entityId: job.id,
      metadata: { next, total: references.length, done: next >= references.length,
        result: verified && references.length ? "CONTROLE" : "RELEVE_INCOMPLET_OU_VIDE", entries } as Prisma.InputJsonValue,
    } });
    return true;
  }, { isolationLevel: "Serializable", maxWait: 2_000, timeout: 20_000 });
}
