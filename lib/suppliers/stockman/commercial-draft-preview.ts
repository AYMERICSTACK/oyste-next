import { getStockmanNeonPrices } from "@/lib/catalogue/stockman-neon-prices";
import { auditStockmanMargin } from "./margin-audit";
import { prisma } from "@/lib/db/prisma";
import { qualifyStockmanCommercialCandidates } from "./commercial-qualification";
import { defaultStockmanCommercialScope, isInStockmanCommercialScope } from "./commercial-scope";
import { getSharedStockmanScope } from "./shared-commercial-scope";

export async function buildStockmanDraftPreview(jobId: string) {
  const job = await prisma.stockmanDiscoveryJob.findUnique({ where: { id: jobId }, select: { options: true, status: true, updatedAt: true } });
  if (!job) return null;
  const options = job.options as { commercialScope?: string[]; excludedReferences?: string[] };
  const shared = await getSharedStockmanScope();
  const keys = options.commercialScope ?? shared?.keys ?? defaultStockmanCommercialScope;
  const excludedReferences = [...new Set([...(options.excludedReferences ?? []), ...(shared?.exclusions ?? [])])];
  const supplier = { OR: [
    { slug: { equals: "stockman", mode: "insensitive" as const } },
    { name: { equals: "stockman", mode: "insensitive" as const } },
    { code: { equals: "stockman", mode: "insensitive" as const } },
  ] };
  const target = { id: true, code: true, name: true, supplierCode: true } as const;
  const [stored, parents, variants, durable, pages] = await Promise.all([
    prisma.stockmanDiscoveryResult.findMany({ where: { jobId }, select: { reference: true, sourceUrl: true, relationType: true, payload: true } }),
    prisma.product.findMany({ where: { supplier }, select: { ...target, publicationStatus: true } }),
    prisma.productVariant.findMany({ where: { product: { supplier } }, select: { ...target, productId: true } }),
    prisma.stockmanCatalogReference.findMany({ select: { reference: true, isActive: true, targetId: true } }),
    prisma.stockmanDiscoveryQueueItem.findMany({ where: { jobId, state: "DONE", nodeType: "PRODUCT" }, select: { canonicalUrl: true, trace: true, updatedAt: true } }),
  ]);
  const scoped = stored.filter((row) => isInStockmanCommercialScope(row.sourceUrl, keys));
  const occurrences = scoped as unknown as Parameters<typeof qualifyStockmanCommercialCandidates>[0]["occurrences"];
  const rows = qualifyStockmanCommercialCandidates({
    occurrences, parents, variants, durable, excludedReferences,
    pages: pages.flatMap((page) => {
      const final = (page.trace as { finalUrl?: string } | null)?.finalUrl;
      const date = page.updatedAt.toISOString();
      return final && final !== page.canonicalUrl ? [{ canonicalUrl: page.canonicalUrl, updatedAt: date }, { canonicalUrl: final, updatedAt: date }] : [{ canonicalUrl: page.canonicalUrl, updatedAt: date }];
    }),
  });
  const salePrices = await getStockmanNeonPrices(rows.map(row => row.reference));
  const newFamilies = new Map<string, string[]>();
  const stageVariants = [];
  for (const row of rows) {
    if (row.classification === "Nouveau parent proposé") {
      const family = newFamilies.get(row.family) ?? [];
      family.push(row.reference);
      newFamilies.set(row.family, family);
    }
    if (row.classification === "Nouvelle variante proposée" && row.parent) {
      stageVariants.push({ reference: row.reference, parent: row.parent, awaitingPublicationDecision: row.parent.status === "PUBLISHED" });
    }
  }
  return {
    jobId, status: job.status, observedAt: job.updatedAt.toISOString(), keys, dryRun: true, executable: false, rows: rows.map(row => {
      const salePriceHT = salePrices.get(row.reference) ?? null;
      return { ...row, salePriceHT, margin: auditStockmanMargin({ purchasePriceHT: row.purchasePriceExVat, salePriceHT }) };
    }),
    draftPlan: {
      newFamilies: [...newFamilies].map(([family, references]) => ({ family, references, publicationStatus: "DRAFT", approvalRequired: true })),
      stageVariants,
    },
  };
}
