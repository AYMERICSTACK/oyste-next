import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { scanStockmanDiscoveryBatch, type StockmanCatalogScanDiagnostics, type StockmanDiscoveredReference, type StockmanDiscoveryBatchNode } from "./catalog-scanner";
import { createStockmanEquivalenceMatcher, type StockmanMatchCandidate } from "./equivalence-engine";
import { persistStockmanLivingReference } from "./living-reference";
import { canonicalizeStockmanUrl } from "./url";
import type { StockmanCatalogDiscovery, StockmanDiscoveryJobProgress, StockmanDiscoveryJobStatus } from "./types";

type ScanOptions = { seedUrl?: string; maxBrowsePages?: number; maxProductPages?: number };
type Limits = Required<Pick<ScanOptions, "maxBrowsePages" | "maxProductPages">> & ScanOptions;
type DurableDiagnostics = {
  discardedUrls: number;
  browseLimitReached: boolean;
  productLimitReached: boolean;
  canonicalizedUrls: number;
  duplicateUrlsAvoided: number;
  categoriesDiscovered: number;
  subcategoriesDiscovered: number;
};
const LEASE_MS = 70_000;
const MAX_ATTEMPTS = 3;

const nowIso = () => new Date().toISOString();
const hashUrl = (url: string) => createHash("sha256").update(url).digest("hex");
function json<T>(value: unknown, fallback: T): T { return value && typeof value === "object" ? value as T : fallback; }
function limits(value: unknown): Limits {
  const data = json<ScanOptions>(value, {});
  return { ...data, maxBrowsePages: Math.min(Math.max(data.maxBrowsePages ?? 500, 1), 500), maxProductPages: Math.min(Math.max(data.maxProductPages ?? 2_000, 1), 2_000) };
}
const baseDiagnostics = (): DurableDiagnostics => ({
  discardedUrls: 0, browseLimitReached: false, productLimitReached: false,
  canonicalizedUrls: 0, duplicateUrlsAvoided: 0, categoriesDiscovered: 0, subcategoriesDiscovered: 0,
});
const baseProgress = (): StockmanDiscoveryJobProgress => ({ phase: "queued", percent: 0, message: "Scan en attente…", pagesVisited: 0, productUrlsFound: 0, productPagesProcessed: 0, referencesFound: 0, failures: 0, updatedAt: nowIso() });

async function counts(jobId: string) {
  const rows = await prisma.stockmanDiscoveryQueueItem.groupBy({ by: ["nodeType", "state"], where: { jobId }, _count: { _all: true } });
  const n = (type: string, states: string[]) => rows.filter((row) => row.nodeType === type && states.includes(row.state)).reduce((sum, row) => sum + row._count._all, 0);
  return {
    browseDone: n("BROWSE", ["DONE"]), browsePending: n("BROWSE", ["PENDING", "PROCESSING"]), browseFailed: n("BROWSE", ["FAILED"]),
    productsFound: n("PRODUCT", ["PENDING", "PROCESSING", "DONE", "FAILED"]), productsDone: n("PRODUCT", ["DONE"]),
    productsPending: n("PRODUCT", ["PENDING", "PROCESSING"]), productsFailed: n("PRODUCT", ["FAILED"]),
  };
}

async function updateProgress(jobId: string, phase: string) {
  const [c, referencesFound] = await Promise.all([counts(jobId), prisma.stockmanDiscoveryResult.count({ where: { jobId } })]);
  const productTotal = Math.max(c.productsFound, 1);
  const progress: StockmanDiscoveryJobProgress = {
    phase: phase === "DISCOVERING" ? "catalogue" : phase === "PARSING_PRODUCTS" ? "products" : phase === "FINISHED" ? "completed" : "matching",
    percent: phase === "DISCOVERING" ? Math.min(35, 2 + c.browseDone) : phase === "PARSING_PRODUCTS" ? Math.min(90, 35 + Math.round(c.productsDone / productTotal * 55)) : phase === "FINISHED" ? 100 : 95,
    message: phase === "DISCOVERING" ? `Exploration durable : ${c.browseDone} page(s), ${c.productsFound} fiche(s) détectée(s).` : phase === "PARSING_PRODUCTS" ? `Lecture durable : ${c.productsDone}/${c.productsFound} · ${referencesFound} référence(s).` : phase === "FINISHED" ? `Scan terminé : ${referencesFound} référence(s) analysée(s).` : "Rapprochement avec le catalogue OYSTE…",
    pagesVisited: c.browseDone, productUrlsFound: c.productsFound, productPagesProcessed: c.productsDone, referencesFound,
    failures: c.browseFailed + c.productsFailed, updatedAt: nowIso(),
  };
  await prisma.stockmanDiscoveryJob.update({ where: { id: jobId }, data: { progress: progress as Prisma.InputJsonValue } });
}

async function acquire(jobId: string, owner: string): Promise<number | null> {
  const now = new Date();
  const result = await prisma.stockmanDiscoveryJob.updateMany({
    where: {
      id: jobId,
      status: { in: ["QUEUED", "RUNNING", "CANCEL_REQUESTED"] },
      OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }],
    },
    data: {
      leaseOwner: owner,
      leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
      leaseVersion: { increment: 1 },
    },
  });
  if (result.count !== 1) return null;
  const leased = await prisma.stockmanDiscoveryJob.findFirst({
    where: { id: jobId, leaseOwner: owner },
    select: { leaseVersion: true },
  });
  return leased?.leaseVersion ?? null;
}

async function fenceLease(jobId: string, owner: string, leaseVersion: number, checkpoint = false) {
  const now = new Date();
  const result = await prisma.stockmanDiscoveryJob.updateMany({
    where: {
      id: jobId, leaseOwner: owner, leaseVersion, leaseExpiresAt: { gt: now },
      status: { in: ["QUEUED", "RUNNING", "CANCEL_REQUESTED"] },
    },
    data: {
      leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
      ...(checkpoint ? { checkpointVersion: { increment: 1 } } : {}),
    },
  });
  if (result.count !== 1) throw new Error("Lease Stockman perdu : batch abandonné avant écriture.");
}

function chooseFairly<T extends { branchKey: string | null }>(items: T[], take: number): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = item.branchKey ?? "__root__";
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  const selected: T[] = [];
  while (selected.length < take) {
    let advanced = false;
    for (const group of groups.values()) {
      const item = group.shift();
      if (!item) continue;
      selected.push(item);
      advanced = true;
      if (selected.length >= take) break;
    }
    if (!advanced) break;
  }
  return selected;
}

async function claim(jobId: string, owner: string, leaseVersion: number, nodeType: "BROWSE" | "PRODUCT", take: number) {
  await fenceLease(jobId, owner, leaseVersion);
  const now = new Date();
  await prisma.stockmanDiscoveryQueueItem.updateMany({
    where: { jobId, state: "PROCESSING", leaseExpiresAt: { lt: now } },
    data: { state: "PENDING", leaseOwner: null, leaseExpiresAt: null, claimVersion: null },
  });
  const pool = await prisma.stockmanDiscoveryQueueItem.findMany({
    where: { jobId, nodeType, state: "PENDING" },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    take: Math.max(take * 50, 100),
  });
  const candidates = chooseFairly(pool, take);
  if (!candidates.length) return [];
  const ids = candidates.map((item) => item.id);
  await prisma.stockmanDiscoveryQueueItem.updateMany({
    where: { id: { in: ids }, state: "PENDING" },
    data: {
      state: "PROCESSING", attempts: { increment: 1 }, leaseOwner: owner,
      leaseExpiresAt: new Date(now.getTime() + LEASE_MS), claimVersion: leaseVersion,
    },
  });
  return prisma.stockmanDiscoveryQueueItem.findMany({
    where: { id: { in: ids }, state: "PROCESSING", leaseOwner: owner, claimVersion: leaseVersion },
  });
}

async function enqueue(
  jobId: string,
  children: Awaited<ReturnType<typeof scanStockmanDiscoveryBatch>>[number]["children"],
  cap: Limits,
  parentBranchKey: string | null,
  parentDepth: number,
) {
  const c = await counts(jobId);
  let browseSlots = Math.max(0, cap.maxBrowsePages - c.browseDone - c.browsePending - c.browseFailed);
  let productSlots = Math.max(0, cap.maxProductPages - c.productsFound);
  let discardedBrowse = 0, discardedProducts = 0, duplicates = 0, canonicalized = 0, categories = 0, subcategories = 0;
  const seen = new Set<string>();
  const normalized = children.flatMap((child) => {
    const url = canonicalizeStockmanUrl(child.url);
    if (!url) return [];
    if (url !== child.url) canonicalized++;
    return [{ child, url, urlHash: hashUrl(url) }];
  });
  const alreadyQueued = new Set((await prisma.stockmanDiscoveryQueueItem.findMany({
    where: { jobId, urlHash: { in: normalized.map((item) => item.urlHash) } },
    select: { nodeType: true, urlHash: true },
  })).map((item) => `${item.nodeType}:${item.urlHash}`));
  const data = [];
  for (const { child, url, urlHash } of normalized) {
    const key = `${child.nodeType}:${urlHash}`;
    if (seen.has(key) || alreadyQueued.has(key)) { duplicates++; continue; }
    seen.add(key);
    if (child.nodeType === "BROWSE" && browseSlots-- <= 0) { discardedBrowse++; continue; }
    if (child.nodeType === "PRODUCT" && productSlots-- <= 0) { discardedProducts++; continue; }
    if (child.navigationKind === "CATEGORY") categories++;
    if (child.navigationKind === "SUBCATEGORY") subcategories++;
    const branchKey = parentDepth === 0 ? urlHash : (parentBranchKey ?? urlHash);
    data.push({
      jobId, canonicalUrl: url, urlHash, nodeType: child.nodeType, depth: child.depth,
      priority: child.nodeType === "BROWSE" ? child.depth : 10_000 + child.depth,
      branchKey, label: child.label,
    });
  }
  if (data.length) await prisma.stockmanDiscoveryQueueItem.createMany({ data, skipDuplicates: true });
  if (discardedBrowse || discardedProducts || duplicates || canonicalized || categories || subcategories) {
    const job = await prisma.stockmanDiscoveryJob.findUniqueOrThrow({ where: { id: jobId }, select: { diagnostics: true } });
    const diagnostic = { ...baseDiagnostics(), ...json(job.diagnostics, baseDiagnostics()) };
    diagnostic.discardedUrls += discardedBrowse + discardedProducts;
    diagnostic.browseLimitReached ||= discardedBrowse > 0;
    diagnostic.productLimitReached ||= discardedProducts > 0;
    diagnostic.duplicateUrlsAvoided += duplicates;
    diagnostic.canonicalizedUrls += canonicalized;
    diagnostic.categoriesDiscovered += categories;
    diagnostic.subcategoriesDiscovered += subcategories;
    await prisma.stockmanDiscoveryJob.update({ where: { id: jobId }, data: { diagnostics: diagnostic as Prisma.InputJsonValue } });
  }
}

async function crawlBatch(jobId: string, owner: string, leaseVersion: number, phase: "DISCOVERING" | "PARSING_PRODUCTS", cap: Limits) {
  const nodeType = phase === "DISCOVERING" ? "BROWSE" : "PRODUCT";
  // Deux navigations maximum, deux tentatives de 12 s chacune : le lot reste
  // borné sous la fenêtre Vercel et checkpointé après chaque nœud.
  const items = await claim(jobId, owner, leaseVersion, nodeType, 2);
  if (!items.length) return false;
  const nodes: StockmanDiscoveryBatchNode[] = items.map((item) => ({ id: item.id, url: item.canonicalUrl, nodeType, label: item.label, depth: item.depth }));
  for (const result of await scanStockmanDiscoveryBatch(nodes)) {
    const item = items.find((candidate) => candidate.id === result.nodeId)!;
    if (result.ok) {
      await fenceLease(jobId, owner, leaseVersion);
      await enqueue(jobId, result.children, cap, item.branchKey, item.depth);
      for (const reference of result.references) {
        const occurrenceKey = createHash("sha256").update([reference.sourceUrl, reference.reference, reference.relationType, reference.familyReference ?? ""].join("\u001f")).digest("hex");
        await prisma.stockmanDiscoveryResult.upsert({
          where: { jobId_occurrenceKey: { jobId, occurrenceKey } },
          create: { jobId, occurrenceKey, reference: reference.reference, sourceUrl: reference.sourceUrl, relationType: reference.relationType, payload: reference as unknown as Prisma.InputJsonValue },
          update: { sourceUrl: reference.sourceUrl, relationType: reference.relationType, payload: reference as unknown as Prisma.InputJsonValue },
        });
      }
      const trace = result.pageTrace ?? { linkTraces: result.linkTraces };
      await prisma.stockmanDiscoveryQueueItem.updateMany({ where: { id: item.id, leaseOwner: owner, claimVersion: leaseVersion }, data: { state: "DONE", leaseOwner: null, leaseExpiresAt: null, claimVersion: null, lastError: null, trace: trace as unknown as Prisma.InputJsonValue } });
    } else {
      await prisma.stockmanDiscoveryQueueItem.updateMany({ where: { id: item.id, leaseOwner: owner, claimVersion: leaseVersion }, data: { state: item.attempts + 1 >= MAX_ATTEMPTS ? "FAILED" : "PENDING", leaseOwner: null, leaseExpiresAt: null, claimVersion: null, lastError: result.error ?? "Lecture impossible" } });
    }
  }
  await fenceLease(jobId, owner, leaseVersion, true);
  await updateProgress(jobId, phase);
  return true;
}

async function buildDiscovery(jobId: string): Promise<StockmanCatalogDiscovery> {
  const [job, stored, queue, products, variants, drafts] = await Promise.all([
    prisma.stockmanDiscoveryJob.findUniqueOrThrow({ where: { id: jobId } }), prisma.stockmanDiscoveryResult.findMany({ where: { jobId }, orderBy: { reference: "asc" } }),
    prisma.stockmanDiscoveryQueueItem.findMany({ where: { jobId }, orderBy: { createdAt: "asc" } }), prisma.product.findMany({ select: { id: true, name: true, supplierCode: true, sourceData: true } }),
    prisma.productVariant.findMany({ select: { id: true, productId: true, name: true, supplierCode: true, sourceData: true } }), prisma.stockmanImportDraft.findMany({ where: { status: "PREPARED" }, select: { reference: true } }),
  ]);
  const occurrences = stored.map((item) => item.payload as unknown as StockmanDiscoveredReference);
  const byReference = new Map<string, StockmanDiscoveredReference>();
  for (const occurrence of occurrences) if (!byReference.has(occurrence.reference)) byReference.set(occurrence.reference, occurrence);
  const references = [...byReference.values()];
  const candidates: StockmanMatchCandidate[] = [];
  for (const p of products) if (p.supplierCode?.trim()) candidates.push({ targetType: "product", targetId: p.id, productId: p.id, targetName: p.name, supplierCode: p.supplierCode.trim(), sourceData: p.sourceData });
  for (const v of variants) if (v.supplierCode?.trim()) candidates.push({ targetType: "variant", targetId: v.id, productId: v.productId, targetName: v.name, supplierCode: v.supplierCode.trim(), sourceData: v.sourceData });
  const matcher = createStockmanEquivalenceMatcher(candidates), prepared = new Set(drafts.map((item) => item.reference.trim().toUpperCase()));
  const matches = references.map(matcher.match).map((match) => ({ ...match, catalogueState: match.status === "matched" || match.status === "already_linked" ? "present" as const : match.status === "missing" && match.missingKind === "confirmed_missing" ? "to_import" as const : "to_review" as const, importPrepared: prepared.has(match.reference.trim().toUpperCase()) }));
  const browse = queue.filter((item) => item.nodeType === "BROWSE"), productsQ = queue.filter((item) => item.nodeType === "PRODUCT"), failed = queue.filter((item) => item.state === "FAILED");
  const durable = { ...baseDiagnostics(), ...json(job.diagnostics, baseDiagnostics()) };
  const pageTraces = productsQ.flatMap((item) => item.trace && typeof item.trace === "object" ? [item.trace as unknown as NonNullable<StockmanCatalogDiscovery["pageTraces"]>[number]] : []);
  const relationCounts = occurrences.reduce((out, item) => ({ ...out, [item.relationType]: (out[item.relationType] ?? 0) + 1 }), {} as Record<string, number>);
  const diagnostics: StockmanCatalogScanDiagnostics = {
    productLinksCollected: productsQ.length, uniqueProductUrls: productsQ.length, productPageAttempts: productsQ.reduce((sum, item) => sum + item.attempts, 0), productPagesOpened: productsQ.filter((item) => item.state === "DONE").length,
    productPageFailures: productsQ.filter((item) => item.state === "FAILED").length, productPageRedirects: pageTraces.filter((t) => t.finalUrl !== t.requestedUrl).length, productPagesWithReferences: pageTraces.filter((t) => t.extractedReferences.length).length,
    productPagesWithoutReferences: pageTraces.filter((t) => !t.extractedReferences.length).length, extractedOccurrences: occurrences.length, duplicateReferences: Math.max(0, occurrences.length - references.length), extractedFromRows: occurrences.length, extractedFromBody: 0,
    noReferenceSamples: pageTraces.filter((t) => !t.extractedReferences.length).slice(0, 12).map((t) => t.finalUrl), failedPageSamples: failed.slice(0, 12).map((item) => `${item.canonicalUrl} · ${item.lastError ?? "Erreur"}`), browseQueueRemaining: 0,
    browseLimitReached: durable.browseLimitReached, productLimitReached: durable.productLimitReached, queueLimitReached: false, discardedUrls: durable.discardedUrls, unvisitedUrls: queue.filter((item) => ["PENDING", "PROCESSING"].includes(item.state)).length,
    navigationErrors: browse.filter((item) => item.state === "FAILED").length, productErrors: productsQ.filter((item) => item.state === "FAILED").length, canonicalizedUrls: durable.canonicalizedUrls, duplicateUrlsAvoided: durable.duplicateUrlsAvoided, categoriesDiscovered: durable.categoriesDiscovered, subcategoriesDiscovered: durable.subcategoriesDiscovered,
    familiesDiscovered: productsQ.length, primaryReferences: (relationCounts.PRIMARY ?? 0) + (relationCounts.PRIMARY_VARIANT ?? 0), accessoryReferences: relationCounts.ACCESSORY ?? 0, optionReferences: relationCounts.OPTION ?? 0,
    relatedProducts: pageTraces.reduce((sum, t) => sum + t.relatedProducts.length, 0), unknownReferences: relationCounts.UNKNOWN ?? 0, scanComplete: !durable.browseLimitReached && !durable.productLimitReached && durable.discardedUrls === 0 && failed.length === 0,
  };
  const m = (kind: string) => matches.filter((item) => item.missingKind === kind).length;
  return { startedAt: (job.startedAt ?? job.createdAt).toISOString(), finishedAt: nowIso(), pagesVisited: browse.filter((item) => item.state === "DONE").length, productPages: productsQ.filter((item) => item.state === "DONE").length, diagnostics,
    totals: { discovered: matches.length, matched: matches.filter((x) => x.status === "matched").length, exact: matches.filter((x) => x.matchMethod === "exact" && ["matched", "already_linked"].includes(x.status)).length, normalized: matches.filter((x) => x.matchMethod === "normalized" && ["matched", "already_linked"].includes(x.status)).length, equivalence: matches.filter((x) => x.matchMethod === "excel" && ["matched", "already_linked"].includes(x.status)).length, suggested: matches.filter((x) => x.status === "suggested").length, missing: matches.filter((x) => x.status === "missing").length, ambiguous: matches.filter((x) => x.status === "ambiguous").length, missingAnalysis: { excelUnmapped: m("excel_unmapped"), referenceClose: m("reference_close"), designationClose: m("designation_close"), familyProbable: m("family_probable"), confirmedMissing: m("confirmed_missing") }, alreadyLinked: matches.filter((x) => x.status === "already_linked").length },
    matches, pageTraces, productLinkTraces: browse.flatMap((item) => json<{ linkTraces?: NonNullable<StockmanCatalogDiscovery["productLinkTraces"]> }>(item.trace, {}).linkTraces ?? []), warnings: failed.map((item) => `${item.canonicalUrl} · ${item.lastError ?? "Lecture impossible"}`).slice(0, 100) };
}

async function finalize(jobId: string, owner: string, leaseVersion: number) {
  await fenceLease(jobId, owner, leaseVersion);
  await prisma.stockmanDiscoveryJob.update({ where: { id: jobId }, data: { phase: "MATCHING" } });
  await updateProgress(jobId, "MATCHING");
  const discovery = await buildDiscovery(jobId);
  await fenceLease(jobId, owner, leaseVersion);
  await prisma.stockmanDiscoveryJob.update({ where: { id: jobId }, data: { phase: "RECONCILING" } });
  discovery.livingReference = await persistStockmanLivingReference(discovery);
  discovery.differential = { presentInOyste: discovery.matches.filter((x) => x.catalogueState === "present").length, toImport: discovery.matches.filter((x) => x.catalogueState === "to_import").length, toReview: discovery.matches.filter((x) => x.catalogueState === "to_review").length, disappearedFromStockman: discovery.livingReference.disappearedSincePreviousScan, preparedForImport: discovery.matches.filter((x) => x.importPrepared).length };
  await fenceLease(jobId, owner, leaseVersion, true);
  await prisma.stockmanDiscoveryJob.updateMany({ where: { id: jobId, leaseOwner: owner, leaseVersion }, data: { status: discovery.diagnostics.scanComplete ? "COMPLETE" : "PARTIAL", phase: "FINISHED", result: discovery as unknown as Prisma.InputJsonValue, diagnostics: discovery.diagnostics as unknown as Prisma.InputJsonValue, finishedAt: new Date(), leaseOwner: null, leaseExpiresAt: null } });
  await updateProgress(jobId, "FINISHED");
}

export async function runNextStockmanDiscoveryBatch(jobId?: string) {
  const selected = jobId ? await prisma.stockmanDiscoveryJob.findUnique({ where: { id: jobId } }) : await prisma.stockmanDiscoveryJob.findFirst({ where: { status: { in: ["QUEUED", "RUNNING", "CANCEL_REQUESTED"] } }, orderBy: { updatedAt: "asc" } });
  if (!selected || !["QUEUED", "RUNNING", "CANCEL_REQUESTED"].includes(selected.status)) return false;
  const owner = randomUUID();
  const leaseVersion = await acquire(selected.id, owner);
  if (leaseVersion === null) return false;
  try {
    let job = await prisma.stockmanDiscoveryJob.findUniqueOrThrow({ where: { id: selected.id } });
    if (job.status === "QUEUED") {
      await prisma.stockmanDiscoveryJob.updateMany({ where: { id: job.id, leaseOwner: owner, leaseVersion, status: "QUEUED" }, data: { status: "RUNNING" } });
      job = await prisma.stockmanDiscoveryJob.findUniqueOrThrow({ where: { id: selected.id } });
    }
    const cap = limits(job.options), c = await counts(job.id);
    if (job.status === "CANCEL_REQUESTED") {
      await prisma.stockmanDiscoveryQueueItem.updateMany({ where: { jobId: job.id, state: { in: ["PENDING", "PROCESSING"] } }, data: { state: "CANCELLED", leaseOwner: null, leaseExpiresAt: null, claimVersion: null } });
      await prisma.stockmanDiscoveryJob.updateMany({ where: { id: job.id, leaseOwner: owner, leaseVersion }, data: { status: "CANCELLED", phase: "FINISHED", finishedAt: new Date(), leaseOwner: null, leaseExpiresAt: null } });
      return true;
    }
    if (job.phase === "DISCOVERING" && c.browsePending) return await crawlBatch(job.id, owner, leaseVersion, "DISCOVERING", cap);
    if (job.phase === "DISCOVERING") {
      await fenceLease(job.id, owner, leaseVersion, true);
      await prisma.stockmanDiscoveryJob.updateMany({ where: { id: job.id, leaseOwner: owner, leaseVersion }, data: { phase: "PARSING_PRODUCTS" } });
    }
    if ((await counts(job.id)).productsPending) return await crawlBatch(job.id, owner, leaseVersion, "PARSING_PRODUCTS", cap);
    await finalize(job.id, owner, leaseVersion);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Le scan Stockman a échoué.";
    await prisma.stockmanDiscoveryJob.updateMany({ where: { id: selected.id, leaseOwner: owner, leaseVersion }, data: { status: "FAILED", phase: "FINISHED", error: message, finishedAt: new Date(), leaseOwner: null, leaseExpiresAt: null } });
    return false;
  } finally {
    await prisma.stockmanDiscoveryJob.updateMany({ where: { id: selected.id, leaseOwner: owner, leaseVersion }, data: { leaseOwner: null, leaseExpiresAt: null } });
  }
}

export async function runStockmanDiscoveryWorkCycle(budgetMs = 45_000) {
  const started = Date.now();
  let batches = 0;
  // Ne démarre pas un nouveau lot dans les 25 dernières secondes : un lot au
  // pire cas (2 pages × 2 tentatives × 12 s) doit pouvoir finir proprement.
  while (batches === 0 || Date.now() - started < budgetMs - 25_000) {
    const processed = await runNextStockmanDiscoveryBatch();
    if (!processed) break;
    batches += 1;
  }
  return batches;
}

export async function startStockmanDiscoveryJob(options: ScanOptions) {
  const seedUrl = canonicalizeStockmanUrl(options.seedUrl?.trim() || "https://www.stockman.fr/");
  if (!seedUrl) throw new Error("L’URL de départ Stockman est invalide.");
  const job = await prisma.stockmanDiscoveryJob.create({ data: { options: limits(options) as Prisma.InputJsonValue, progress: baseProgress() as Prisma.InputJsonValue, diagnostics: baseDiagnostics() as Prisma.InputJsonValue, startedAt: new Date() } });
  await prisma.stockmanDiscoveryQueueItem.create({ data: { jobId: job.id, canonicalUrl: seedUrl, urlHash: hashUrl(seedUrl), nodeType: "BROWSE", branchKey: "__root__" } });
  return getStockmanDiscoveryJob(job.id);
}

export async function getStockmanDiscoveryJob(jobId: string): Promise<StockmanDiscoveryJobStatus | null> {
  const job = await prisma.stockmanDiscoveryJob.findUnique({ where: { id: jobId } });
  if (!job) return null;
  const status = (job.status === "COMPLETE" ? "completed" : job.status.toLowerCase()) as StockmanDiscoveryJobStatus["status"];
  return { jobId: job.id, status, createdAt: job.createdAt.toISOString(), startedAt: job.startedAt?.toISOString() ?? null, finishedAt: job.finishedAt?.toISOString() ?? null, progress: json(job.progress, baseProgress()), ...(job.result ? { result: job.result as unknown as StockmanCatalogDiscovery } : {}), ...(job.error ? { error: job.error } : {}) };
}

export async function cancelStockmanDiscoveryJob(jobId: string) {
  return (await prisma.stockmanDiscoveryJob.updateMany({
    where: { id: jobId, status: { in: ["QUEUED", "RUNNING"] } },
    data: { status: "CANCEL_REQUESTED", cancelRequestedAt: new Date() },
  })).count === 1;
}
