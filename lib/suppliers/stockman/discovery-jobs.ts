import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { scanStockmanDiscoveryBatch, type StockmanCatalogScanDiagnostics, type StockmanDiscoveredReference, type StockmanDiscoveryBatchNode } from "./catalog-scanner";
import { createStockmanEquivalenceMatcher, type StockmanMatchCandidate } from "./equivalence-engine";
import { persistStockmanLivingReference } from "./living-reference";
import { canonicalizeStockmanUrl, stockmanQueueIdentity, stockmanUrlLanguage, stockmanTaxonomyIdentity } from "./url";
import { chooseStockmanBranch, hasStockmanCrawlWork, planStockmanCrawlBatch, type StockmanCrawlNodeType } from "./queue-policy";
import { stockmanPartialReasons } from "./scan-completeness";
import type { StockmanCatalogDiscovery, StockmanCatalogMatch, StockmanDiscoveryJobProgress, StockmanDiscoveryJobStatus } from "./types";

type ScanOptions = { seedUrl?: string; maxBrowsePages?: number; maxProductPages?: number };
type Limits = Required<Pick<ScanOptions, "maxBrowsePages" | "maxProductPages">> & ScanOptions;
type MatchingState = {
  version: 1;
  nextIndex: number;
  total: number;
  matches: StockmanCatalogMatch[];
};

type DurableDiagnostics = {
  discardedUrls: number;
  browseLimitReached: boolean;
  productLimitReached: boolean;
  queueLimitReached: boolean;
  canonicalizedUrls: number;
  duplicateUrlsAvoided: number;
  categoriesDiscovered: number;
  subcategoriesDiscovered: number;
  matching?: MatchingState;
  matchingPayloadBytes?: number;
  reconciling?: { nextIndex: number; finishedAt: string; newCount: number; changedCount: number };
  crawlCounters?: Record<string, number>;
  discoveryYield?: {
    pagesMeasured: number;
    productsDiscovered: number;
    recentProductsPerPage: number[];
    consecutiveWithoutProduct: number;
    maxConsecutiveWithoutProduct: number;
  };
};
const LEASE_MS = 70_000;
const MAX_ATTEMPTS = 3;
const MATCH_BATCH_SIZE = 50;
const CRAWL_BATCH_SIZE = 3;
const YIELD_WINDOW_PAGES = 25;

const nowIso = () => new Date().toISOString();
const hashUrl = (url: string) => createHash("sha256").update(stockmanQueueIdentity(url) ?? url).digest("hex");
function json<T>(value: unknown, fallback: T): T { return value && typeof value === "object" ? value as T : fallback; }
function limits(value: unknown): Limits {
  const data = json<ScanOptions>(value, {});
  return { ...data, maxBrowsePages: Math.min(Math.max(data.maxBrowsePages ?? 5_000, 1), 5_000), maxProductPages: Math.min(Math.max(data.maxProductPages ?? 10_000, 1), 10_000) };
}
const baseDiagnostics = (): DurableDiagnostics => ({
  discardedUrls: 0, browseLimitReached: false, productLimitReached: false, queueLimitReached: false,
  canonicalizedUrls: 0, duplicateUrlsAvoided: 0, categoriesDiscovered: 0, subcategoriesDiscovered: 0,
});

const baseDiscoveryYield = (): NonNullable<DurableDiagnostics["discoveryYield"]> => ({
  pagesMeasured: 0,
  productsDiscovered: 0,
  recentProductsPerPage: [],
  consecutiveWithoutProduct: 0,
  maxConsecutiveWithoutProduct: 0,
});

function matchingState(value: unknown): MatchingState | null {
  const state = json<Partial<MatchingState>>(value, {});
  if (state.version !== 1 || !Array.isArray(state.matches)) return null;
  return {
    version: 1,
    nextIndex: Math.max(0, typeof state.nextIndex === "number" && Number.isFinite(state.nextIndex) ? state.nextIndex : 0),
    total: Math.max(0, typeof state.total === "number" && Number.isFinite(state.total) ? state.total : 0),
    matches: state.matches as StockmanCatalogMatch[],
  };
}

function catalogueStateForMatch(match: StockmanCatalogMatch) {
  return match.status === "matched" || match.status === "already_linked"
    ? "present" as const
    : match.status === "missing" && match.missingKind === "confirmed_missing"
      ? "to_import" as const
      : "to_review" as const;
}
const baseProgress = (): StockmanDiscoveryJobProgress => ({ phase: "queued", percent: 0, message: "Scan en attente…", pagesVisited: 0, productUrlsFound: 0, productPagesProcessed: 0, referencesFound: 0, failures: 0, updatedAt: nowIso() });

async function counts(jobId: string, db = prisma) {
  const rows = await db.stockmanDiscoveryQueueItem.groupBy({ by: ["nodeType", "state"], where: { jobId }, _count: { _all: true } });
  const n = (type: string, states: string[]) => rows.filter((row) => row.nodeType === type && states.includes(row.state)).reduce((sum, row) => sum + row._count._all, 0);
  return {
    queueTotal: rows.reduce((sum, row) => sum + row._count._all, 0),
    browseDone: n("BROWSE", ["DONE"]), browsePending: n("BROWSE", ["PENDING", "PROCESSING"]), browseFailed: n("BROWSE", ["FAILED"]),
    productsFound: n("PRODUCT", ["PENDING", "PROCESSING", "DONE", "FAILED"]), productsDone: n("PRODUCT", ["DONE"]),
    productsPending: n("PRODUCT", ["PENDING", "PROCESSING"]), productsFailed: n("PRODUCT", ["FAILED"]),
  };
}

async function updateProgress(jobId: string, phase: string, owner: string, leaseVersion: number) {
  const recentSince = new Date(Date.now() - 15 * 60_000);
  const [c, referencesFound, job, recentBrowseDone, recentProductsDone] = await Promise.all([
    counts(jobId),
    prisma.stockmanDiscoveryResult.count({ where: { jobId } }),
    prisma.stockmanDiscoveryJob.findUnique({ where: { id: jobId }, select: { diagnostics: true, startedAt: true, createdAt: true } }),
    prisma.stockmanDiscoveryQueueItem.count({ where: { jobId, nodeType: "BROWSE", state: "DONE", updatedAt: { gte: recentSince } } }),
    prisma.stockmanDiscoveryQueueItem.count({ where: { jobId, nodeType: "PRODUCT", state: "DONE", updatedAt: { gte: recentSince } } }),
  ]);
  const durable = job ? { ...baseDiagnostics(), ...json(job.diagnostics, baseDiagnostics()) } : baseDiagnostics();
  const yieldState = { ...baseDiscoveryYield(), ...durable.discoveryYield };
  const matching = matchingState(durable.matching);
  const matchingDone = matching?.nextIndex ?? 0;
  const matchingTotal = matching?.total ?? 0;
  const matchingPercent = matchingTotal > 0 ? Math.min(98, 90 + Math.round((matchingDone / matchingTotal) * 8)) : 90;
  const elapsedMinutes = Math.max(1 / 60, (Date.now() - (job?.startedAt ?? job?.createdAt ?? new Date()).getTime()) / 60_000);
  const rateWindowMinutes = Math.min(15, elapsedMinutes);
  const hasRateSample = elapsedMinutes >= 2;
  const browsePerMinute = hasRateSample ? Math.round((recentBrowseDone / rateWindowMinutes) * 10) / 10 : null;
  const productsPerMinute = hasRateSample ? Math.round((recentProductsDone / rateWindowMinutes) * 10) / 10 : null;
  const etaParts = [
    c.browsePending > 0 && browsePerMinute ? c.browsePending / browsePerMinute : c.browsePending > 0 ? null : 0,
    c.productsPending > 0 && productsPerMinute ? c.productsPending / productsPerMinute : c.productsPending > 0 ? null : 0,
  ];
  const etaMinutes = hasRateSample && etaParts.every((value) => value !== null)
    ? Math.max(1, Math.ceil(etaParts.reduce<number>((sum, value) => sum + (value ?? 0), 0)))
    : null;
  const crawlKnown = c.browseDone + c.browsePending + c.browseFailed + c.productsDone + c.productsPending + c.productsFailed;
  const crawlDone = c.browseDone + c.productsDone;
  const crawlPercent = crawlKnown > 0 ? Math.min(89, Math.max(2, Math.round((crawlDone / crawlKnown) * 89))) : 2;
  const recentProducts = yieldState.recentProductsPerPage.reduce((sum, value) => sum + value, 0);
  const recentYield = yieldState.recentProductsPerPage.length
    ? Math.round((recentProducts / yieldState.recentProductsPerPage.length) * 100) / 100
    : null;
  const crawling = phase === "DISCOVERING" || phase === "PARSING_PRODUCTS";
  const activity = crawling
    ? c.browsePending > 0 && c.productsPending > 0 ? "mixed" as const : c.productsPending > 0 ? "products" as const : c.browsePending > 0 ? "browse" as const : "idle" as const
    : phase === "MATCHING" ? "matching" as const : phase === "RECONCILING" ? "reconciling" as const : "idle" as const;
  const progress: StockmanDiscoveryJobProgress = {
    phase: crawling ? (c.productsDone > 0 ? "products" : "catalogue") : phase === "FINISHED" ? "completed" : "matching",
    percent: crawling ? crawlPercent : phase === "FINISHED" ? 100 : matchingPercent,
    message: crawling
      ? `Crawl entrelacé : ${c.browseDone} page(s) browse, ${c.productsDone}/${c.productsFound} fiche(s) lue(s), ${referencesFound} référence(s).`
      : phase === "FINISHED"
          ? `Scan terminé : ${referencesFound} référence(s) analysée(s).`
          : matchingTotal > 0
            ? `Rapprochement durable : ${matchingDone}/${matchingTotal} référence(s).`
            : "Préparation du rapprochement avec le catalogue OYSTE…",
    pagesVisited: c.browseDone, productUrlsFound: c.productsFound, productPagesProcessed: c.productsDone, referencesFound,
    failures: c.browseFailed + c.productsFailed, updatedAt: nowIso(), activity,
    browseDone: c.browseDone, browsePending: c.browsePending, browseFailed: c.browseFailed,
    productsPending: c.productsPending, productsFailed: c.productsFailed,
    browsePerMinute, productsPerMinute,
    recentBrowsePages: yieldState.recentProductsPerPage.length,
    recentProductsDiscovered: recentProducts,
    recentDiscoveryYield: recentYield,
    consecutiveBrowseWithoutProduct: yieldState.consecutiveWithoutProduct,
    etaMinutes,
    etaLabel: etaMinutes === null ? "ETA indisponible : débit récent insuffisant" : `ETA approximative : ${etaMinutes} min`,
  };
  await prisma.stockmanDiscoveryJob.updateMany({ where: { id: jobId, leaseOwner: owner, leaseVersion, leaseExpiresAt: { gt: new Date() }, status: { in: ["QUEUED", "RUNNING"] } }, data: { progress: progress as Prisma.InputJsonValue } });
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

async function fenceLease(jobId: string, owner: string, leaseVersion: number, checkpoint = false, db = prisma) {
  const now = new Date();
  const result = await db.stockmanDiscoveryJob.updateMany({
    where: {
      id: jobId, leaseOwner: owner, leaseVersion, leaseExpiresAt: { gt: now },
      status: { in: ["QUEUED", "RUNNING"] },
    },
    data: {
      leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
      ...(checkpoint ? { checkpointVersion: { increment: 1 } } : {}),
    },
  });
  if (result.count !== 1) throw new Error("Lease Stockman perdu : batch abandonné avant écriture.");
}

async function claim(jobId: string, owner: string, leaseVersion: number, nodeType: "BROWSE" | "PRODUCT", take: number) {
  await fenceLease(jobId, owner, leaseVersion);
  const now = new Date();
  await prisma.stockmanDiscoveryQueueItem.updateMany({
    where: { jobId, state: "PROCESSING", leaseExpiresAt: { lt: now } },
    data: { state: "PENDING", leaseOwner: null, leaseExpiresAt: null, claimVersion: null },
  });
  const [pendingBranches, processedBranches] = await Promise.all([
    prisma.stockmanDiscoveryQueueItem.groupBy({ by: ["branchKey"], where: { jobId, nodeType, state: "PENDING" }, _min: { priority: true } }),
    prisma.stockmanDiscoveryQueueItem.groupBy({ by: ["branchKey"], where: { jobId, nodeType, state: { in: ["DONE", "FAILED"] } }, _max: { updatedAt: true } }),
  ]);
  const lastProcessed = new Map(processedBranches.map((item) => [item.branchKey, item._max.updatedAt?.getTime() ?? null]));
  const branch = chooseStockmanBranch(pendingBranches.map((item) => ({ branchKey: item.branchKey, priority: item._min.priority ?? 0, lastProcessedAt: lastProcessed.get(item.branchKey) ?? null })));
  if (!branch) return [];
  const candidates = await prisma.stockmanDiscoveryQueueItem.findMany({
    where: { jobId, nodeType, state: "PENDING", branchKey: branch.branchKey },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }, { id: "asc" }], take,
  });
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
  parentUrl: string,
  db = prisma,
) {
  const c = await counts(jobId, db);
  let browseSlots = Math.max(0, cap.maxBrowsePages - c.browseDone - c.browsePending - c.browseFailed);
  let productSlots = Math.max(0, cap.maxProductPages - c.productsFound);
  let queueSlots = Math.max(0, 50_000 - c.queueTotal);
  let discardedQueue = 0;
  let discardedBrowse = 0, discardedProducts = 0, duplicates = 0, canonicalized = 0, categories = 0, subcategories = 0;
  const seen = new Set<string>();
  const normalized = children.flatMap((child) => {
    const url = canonicalizeStockmanUrl(child.url);
    if (!url) return [];
    if (url !== child.url) canonicalized++;
    return [{ child, url, urlHash: hashUrl(url) }];
  });
  const queued = await db.stockmanDiscoveryQueueItem.findMany({
    where: { jobId, urlHash: { in: normalized.map((item) => item.urlHash) } },
    select: { nodeType: true, urlHash: true, canonicalUrl: true },
  });
  const alreadyQueued = new Set(queued.map((item) => `${item.nodeType}:${item.urlHash}`));
  const duplicateReasons: Record<string, number> = {};
  const countReason = (key: string) => { duplicateReasons[key] = (duplicateReasons[key] ?? 0) + 1; };
  const data = [];
  for (const { child, url, urlHash } of normalized) {
    const key = `${child.nodeType}:${urlHash}`;
    if (seen.has(key) || alreadyQueued.has(key)) { duplicates++; countReason(seen.has(key) ? "duplicate:within-page" : "duplicate:durable-queue"); continue; }
    seen.add(key);
    if (queueSlots-- <= 0) { discardedQueue++; countReason("rejected:queue-safety-limit"); continue; }
    const omitted = child.nodeType === "BROWSE" ? browseSlots-- <= 0 : productSlots-- <= 0;
    if (omitted) { if (child.nodeType === "BROWSE") discardedBrowse++; else discardedProducts++; }
    if (child.navigationKind === "CATEGORY") categories++;
    if (child.navigationKind === "SUBCATEGORY") subcategories++;
    const branchKey = parentDepth === 0 ? urlHash : (parentBranchKey ?? urlHash);
    data.push({
      jobId, canonicalUrl: url, urlHash, nodeType: child.nodeType, depth: child.depth,
      priority: child.nodeType === "BROWSE" ? child.depth : 10_000 + child.depth,
      branchKey, label: child.label, discoveredFrom: parentUrl,
      state: omitted ? "CANCELLED" as const : "PENDING" as const,
      lastError: omitted ? "Safety limit: URL not visited" : null,
    });
  }
  if (data.length) await db.stockmanDiscoveryQueueItem.createMany({ data, skipDuplicates: true });
  if (discardedQueue || discardedBrowse || discardedProducts || duplicates || canonicalized || categories || subcategories) {
    const job = await db.stockmanDiscoveryJob.findUniqueOrThrow({ where: { id: jobId }, select: { diagnostics: true } });
    const diagnostic = { ...baseDiagnostics(), ...json(job.diagnostics, baseDiagnostics()) };
    diagnostic.discardedUrls += discardedBrowse + discardedProducts + discardedQueue;
    diagnostic.queueLimitReached ||= discardedQueue > 0;
    diagnostic.browseLimitReached ||= discardedBrowse > 0;
    diagnostic.productLimitReached ||= discardedProducts > 0;
    diagnostic.duplicateUrlsAvoided += duplicates;
    diagnostic.canonicalizedUrls += canonicalized;
    diagnostic.categoriesDiscovered += categories;
    diagnostic.subcategoriesDiscovered += subcategories;
    const counters = { ...diagnostic.crawlCounters };
    for (const [key, count] of Object.entries(duplicateReasons)) counters[key] = (counters[key] ?? 0) + count;
    diagnostic.crawlCounters = counters;
    await db.stockmanDiscoveryJob.update({ where: { id: jobId }, data: { diagnostics: diagnostic as Prisma.InputJsonValue } });
  }
  return {
    newBrowseQueued: data.filter((item) => item.nodeType === "BROWSE" && item.state === "PENDING").length,
    newProductsQueued: data.filter((item) => item.nodeType === "PRODUCT" && item.state === "PENDING").length,
  };
}

async function persistCrawlResult(
  jobId: string,
  owner: string,
  leaseVersion: number,
  cap: Limits,
  item: Awaited<ReturnType<typeof claim>>[number],
  result: Awaited<ReturnType<typeof scanStockmanDiscoveryBatch>>[number],
) {
  await prisma.$transaction(async (tx) => {
    const db = tx as unknown as typeof prisma;
    await fenceLease(jobId, owner, leaseVersion, true, db);
    if (!result.ok) {
      await db.stockmanDiscoveryQueueItem.updateMany({
        where: { id: item.id, leaseOwner: owner, claimVersion: leaseVersion },
        data: {
          state: item.attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
          leaseOwner: null,
          leaseExpiresAt: null,
          claimVersion: null,
          lastError: result.error ?? "Lecture impossible",
        },
      });
      return;
    }

    const enqueued = await enqueue(jobId, result.children, cap, item.branchKey, item.depth, result.finalUrl, db);
    for (const reference of result.references) {
      const occurrenceKey = createHash("sha256")
        .update([reference.sourceUrl, reference.reference, reference.relationType, reference.familyReference ?? ""].join("\u001f"))
        .digest("hex");
      await db.stockmanDiscoveryResult.upsert({
        where: { jobId_occurrenceKey: { jobId, occurrenceKey } },
        create: { jobId, occurrenceKey, reference: reference.reference, sourceUrl: reference.sourceUrl, relationType: reference.relationType, payload: reference as unknown as Prisma.InputJsonValue },
        update: { sourceUrl: reference.sourceUrl, relationType: reference.relationType, payload: reference as unknown as Prisma.InputJsonValue },
      });
    }
    const catalogueSignature = createHash("sha256").update(JSON.stringify([...new Set(result.children.map((child) => {
      const url = new URL(child.url);
      return `${child.navigationKind}:${url.pathname.match(/--([^/]+)\.aspx$/i)?.[1] ?? url.pathname}${url.search}`;
    }))].sort())).digest("hex");
    const trace = result.pageTrace ?? {
      catalogueSignature,
      taxonomyCandidateIdentity: stockmanTaxonomyIdentity(result.finalUrl),
      finalUrl: result.finalUrl,
      linkTraces: result.linkTraces,
      counters: result.counters,
    };
    const current = await db.stockmanDiscoveryJob.findUniqueOrThrow({ where: { id: jobId }, select: { diagnostics: true } });
    const diagnostics = { ...baseDiagnostics(), ...json(current.diagnostics, baseDiagnostics()) };
    const counters = { ...diagnostics.crawlCounters };
    for (const [key, count] of Object.entries(result.counters)) counters[key] = (counters[key] ?? 0) + count;
    const language = stockmanUrlLanguage(result.finalUrl);
    const taxonomyKind = new URL(result.finalUrl).pathname.match(/--(\d+)\.aspx$/i)
      ? ([...new URL(result.finalUrl).pathname.matchAll(/--\d+(?=\.aspx$|\/|$)/g)].length > 1 ? "SUBCATEGORY" : "CATEGORY")
      : item.nodeType;
    const pageKey = `visited:${language}:${taxonomyKind}`;
    counters[pageKey] = (counters[pageKey] ?? 0) + 1;

    let discoveryYield = diagnostics.discoveryYield;
    if (item.nodeType === "BROWSE") {
      const previous = { ...baseDiscoveryYield(), ...diagnostics.discoveryYield };
      const recentProductsPerPage = [...previous.recentProductsPerPage, enqueued.newProductsQueued].slice(-YIELD_WINDOW_PAGES);
      const consecutiveWithoutProduct = enqueued.newProductsQueued === 0 ? previous.consecutiveWithoutProduct + 1 : 0;
      discoveryYield = {
        pagesMeasured: previous.pagesMeasured + 1,
        productsDiscovered: previous.productsDiscovered + enqueued.newProductsQueued,
        recentProductsPerPage,
        consecutiveWithoutProduct,
        maxConsecutiveWithoutProduct: Math.max(previous.maxConsecutiveWithoutProduct, consecutiveWithoutProduct),
      };
    }

    await db.stockmanDiscoveryJob.update({
      where: { id: jobId },
      data: { diagnostics: { ...diagnostics, crawlCounters: counters, discoveryYield } as unknown as Prisma.InputJsonValue },
    });
    await db.stockmanDiscoveryQueueItem.updateMany({
      where: { id: item.id, leaseOwner: owner, claimVersion: leaseVersion },
      data: { state: "DONE", leaseOwner: null, leaseExpiresAt: null, claimVersion: null, lastError: null, trace: trace as unknown as Prisma.InputJsonValue },
    });
  }, { timeout: 20_000 });
}

async function claimScheduledItems(
  jobId: string,
  owner: string,
  leaseVersion: number,
  plan: StockmanCrawlNodeType[],
) {
  const items: Awaited<ReturnType<typeof claim>> = [];
  for (const nodeType of plan) {
    const claimed = await claim(jobId, owner, leaseVersion, nodeType, 1);
    if (claimed[0]) items.push(claimed[0]);
  }
  return items;
}

async function crawlBatch(jobId: string, owner: string, leaseVersion: number, phase: "DISCOVERING" | "PARSING_PRODUCTS", cap: Limits) {
  const backlog = await counts(jobId);
  const plan = planStockmanCrawlBatch(backlog, CRAWL_BATCH_SIZE);
  const items = await claimScheduledItems(jobId, owner, leaseVersion, plan);
  if (!items.length) return false;
  const nodes: StockmanDiscoveryBatchNode[] = items.map((item) => ({
    id: item.id,
    url: item.canonicalUrl,
    nodeType: item.nodeType as StockmanCrawlNodeType,
    label: item.label,
    depth: item.depth,
  }));

  // One browser/context is reused for the bounded mixed batch. The callback
  // checkpoints every node before the next navigation starts.
  await scanStockmanDiscoveryBatch(nodes, async (result) => {
    const item = items.find((candidate) => candidate.id === result.nodeId);
    if (!item) throw new Error(`Nœud Stockman réclamé introuvable : ${result.nodeId}`);
    await persistCrawlResult(jobId, owner, leaseVersion, cap, item, result);
  });
  await updateProgress(jobId, phase, owner, leaseVersion);
  return true;
}

async function uniqueReferencesForMatching(jobId: string) {
  const stored = await prisma.stockmanDiscoveryResult.findMany({
    where: { jobId },
    orderBy: [{ reference: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: { payload: true },
  });
  const byReference = new Map<string, StockmanDiscoveredReference>();
  for (const item of stored) {
    const occurrence = item.payload as unknown as StockmanDiscoveredReference;
    if (!byReference.has(occurrence.reference) || stockmanUrlLanguage(occurrence.sourceUrl) === "fr" && stockmanUrlLanguage(byReference.get(occurrence.reference)!.sourceUrl) !== "fr") byReference.set(occurrence.reference, occurrence);
  }
  return [...byReference.values()];
}

async function runMatchingBatch(jobId: string, owner: string, leaseVersion: number) {
  await fenceLease(jobId, owner, leaseVersion);
  const [job, references, products, variants, drafts] = await Promise.all([
    prisma.stockmanDiscoveryJob.findUniqueOrThrow({ where: { id: jobId }, select: { diagnostics: true } }),
    uniqueReferencesForMatching(jobId),
    prisma.product.findMany({ select: { id: true, name: true, supplierCode: true, sourceData: true } }),
    prisma.productVariant.findMany({ select: { id: true, productId: true, name: true, supplierCode: true, sourceData: true } }),
    prisma.stockmanImportDraft.findMany({ where: { status: "PREPARED" }, select: { reference: true } }),
  ]);

  const durable = { ...baseDiagnostics(), ...json(job.diagnostics, baseDiagnostics()) };
  const previous = matchingState(durable.matching);
  const total = references.length;
  const state: MatchingState = previous && previous.total === total
    ? previous
    : { version: 1, nextIndex: 0, total, matches: [] };

  if (state.nextIndex >= total) {
    const progress = {
      ...(json<StockmanDiscoveryJobProgress>((await prisma.stockmanDiscoveryJob.findUniqueOrThrow({ where: { id: jobId }, select: { progress: true } })).progress, baseProgress())),
      phase: "matching", percent: 98, message: `Rapprochement durable terminé : ${total}/${total} référence(s).`, updatedAt: nowIso(),
    };
    const transitioned = await prisma.stockmanDiscoveryJob.updateMany({
      where: { id: jobId, leaseOwner: owner, leaseVersion, leaseExpiresAt: { gt: new Date() }, status: { in: ["QUEUED", "RUNNING"] } },
      data: { phase: "RECONCILING", progress: progress as Prisma.InputJsonValue, checkpointVersion: { increment: 1 }, leaseExpiresAt: new Date(Date.now() + LEASE_MS) },
    });
    if (transitioned.count !== 1) throw new Error("Lease Stockman perdu : transition matching abandonnée.");
    return true;
  }

  const candidates: StockmanMatchCandidate[] = [];
  for (const product of products) if (product.supplierCode?.trim()) candidates.push({ targetType: "product", targetId: product.id, productId: product.id, targetName: product.name, supplierCode: product.supplierCode.trim(), sourceData: product.sourceData });
  for (const variant of variants) if (variant.supplierCode?.trim()) candidates.push({ targetType: "variant", targetId: variant.id, productId: variant.productId, targetName: variant.name, supplierCode: variant.supplierCode.trim(), sourceData: variant.sourceData });
  const matcher = createStockmanEquivalenceMatcher(candidates);
  const prepared = new Set(drafts.map((item) => item.reference.trim().toUpperCase()));
  const end = Math.min(total, state.nextIndex + MATCH_BATCH_SIZE);
  const matched = references.slice(state.nextIndex, end).map(matcher.match).map((match) => ({
    ...match,
    catalogueState: catalogueStateForMatch(match),
    importPrepared: prepared.has(match.reference.trim().toUpperCase()),
  }));
  const nextState: MatchingState = { version: 1, nextIndex: end, total, matches: [...state.matches, ...matched] };
  const nextDiagnostics: DurableDiagnostics = { ...durable, matching: nextState, matchingPayloadBytes: Buffer.byteLength(JSON.stringify(nextState), "utf8") };
  const c = await counts(jobId);
  const referencesFound = await prisma.stockmanDiscoveryResult.count({ where: { jobId } });
  const progress: StockmanDiscoveryJobProgress = {
    phase: "matching",
    percent: total > 0 ? Math.min(98, 90 + Math.round((end / total) * 8)) : 98,
    message: `Rapprochement durable : ${end}/${total} référence(s).`,
    pagesVisited: c.browseDone, productUrlsFound: c.productsFound, productPagesProcessed: c.productsDone, referencesFound,
    failures: c.browseFailed + c.productsFailed, updatedAt: nowIso(),
  };
  const updated = await prisma.stockmanDiscoveryJob.updateMany({
    where: { id: jobId, leaseOwner: owner, leaseVersion, leaseExpiresAt: { gt: new Date() }, status: { in: ["QUEUED", "RUNNING"] } },
    data: {
      diagnostics: nextDiagnostics as unknown as Prisma.InputJsonValue,
      progress: progress as Prisma.InputJsonValue,
      checkpointVersion: { increment: 1 },
      leaseExpiresAt: new Date(Date.now() + LEASE_MS),
    },
  });
  if (updated.count !== 1) throw new Error("Lease Stockman perdu : batch de matching abandonné avant écriture.");
  return true;
}

async function buildDiscovery(jobId: string): Promise<StockmanCatalogDiscovery> {
  const [job, stored, queue] = await Promise.all([
    prisma.stockmanDiscoveryJob.findUniqueOrThrow({ where: { id: jobId } }),
    prisma.stockmanDiscoveryResult.findMany({ where: { jobId }, orderBy: [{ reference: "asc" }, { createdAt: "asc" }, { id: "asc" }] }),
    prisma.stockmanDiscoveryQueueItem.findMany({ where: { jobId }, orderBy: { createdAt: "asc" } }),
  ]);
  const occurrences = stored.map((item) => item.payload as unknown as StockmanDiscoveredReference);
  const byReference = new Map<string, StockmanDiscoveredReference>();
  for (const occurrence of occurrences) if (!byReference.has(occurrence.reference) || stockmanUrlLanguage(occurrence.sourceUrl) === "fr" && stockmanUrlLanguage(byReference.get(occurrence.reference)!.sourceUrl) !== "fr") byReference.set(occurrence.reference, occurrence);
  const references = [...byReference.values()];
  const durable = { ...baseDiagnostics(), ...json(job.diagnostics, baseDiagnostics()) };
  const matching = matchingState(durable.matching);
  if (!matching || matching.nextIndex !== references.length || matching.total !== references.length || matching.matches.length !== references.length) {
    throw new Error(`Rapprochement Stockman incomplet : ${matching?.nextIndex ?? 0}/${references.length}.`);
  }
  const matches = matching.matches;
  const browse = queue.filter((item) => item.nodeType === "BROWSE"), productsQ = queue.filter((item) => item.nodeType === "PRODUCT"), failed = queue.filter((item) => item.state === "FAILED");
  const pageTraces = productsQ.flatMap((item) => item.trace && typeof item.trace === "object" ? [item.trace as unknown as NonNullable<StockmanCatalogDiscovery["pageTraces"]>[number]] : []);
  const relationCounts = occurrences.reduce((out, item) => ({ ...out, [item.relationType]: (out[item.relationType] ?? 0) + 1 }), {} as Record<string, number>);
  const frReferences = new Set(occurrences.filter((item) => stockmanUrlLanguage(item.sourceUrl) === "fr").map((item) => item.reference));
  const enReferences = new Set(occurrences.filter((item) => stockmanUrlLanguage(item.sourceUrl) === "en").map((item) => item.reference));
  const sharedReferences = [...frReferences].filter((reference) => enReferences.has(reference)).length;
  const browseQueueRemaining = browse.filter((item) => ["PENDING", "PROCESSING"].includes(item.state)).length;
  const unvisitedUrls = queue.filter((item) => item.state !== "DONE").length;
  const navigationErrors = browse.filter((item) => item.state === "FAILED").length;
  const productErrors = productsQ.filter((item) => item.state === "FAILED").length;
  const scanComplete = json<{ coveragePolicyVersion?: number }>(job.options, {}).coveragePolicyVersion === 1
    && canonicalizeStockmanUrl(json<ScanOptions>(job.options, {}).seedUrl || "https://www.stockman.fr/") === "https://www.stockman.fr/"
    && !durable.browseLimitReached
    && !durable.productLimitReached
    && !durable.queueLimitReached
    && durable.discardedUrls === 0
    && failed.length === 0
    && queue.every((item) => item.state === "DONE")
    && browse.length > 0
    && productsQ.length > 0;
  const partialReasons = stockmanPartialReasons({
    scanComplete,
    browseLimitReached: durable.browseLimitReached,
    productLimitReached: durable.productLimitReached,
    queueLimitReached: durable.queueLimitReached,
    discardedUrls: durable.discardedUrls,
    unvisitedUrls,
    navigationErrors,
    productErrors,
    productPageFailures: productErrors,
    browseQueueRemaining,
  });
  const yieldState = { ...baseDiscoveryYield(), ...durable.discoveryYield };
  const recentProductsDiscovered = yieldState.recentProductsPerPage.reduce((sum, value) => sum + value, 0);
  const diagnostics: StockmanCatalogScanDiagnostics = {
    languageCoverage: { frUniqueReferences: frReferences.size, enUniqueReferences: enReferences.size, sharedReferences, frOnlyReferences: frReferences.size - sharedReferences, enOnlyReferences: enReferences.size - sharedReferences },
    productLinksCollected: productsQ.length, uniqueProductUrls: productsQ.length, productPageAttempts: productsQ.reduce((sum, item) => sum + item.attempts, 0), productPagesOpened: productsQ.filter((item) => item.state === "DONE").length,
    productPageFailures: productsQ.filter((item) => item.state === "FAILED").length, productPageRedirects: pageTraces.filter((t) => t.finalUrl !== t.requestedUrl).length, productPagesWithReferences: pageTraces.filter((t) => t.extractedReferences.length).length,
    productPagesWithoutReferences: pageTraces.filter((t) => !t.extractedReferences.length).length, extractedOccurrences: occurrences.length, duplicateReferences: Math.max(0, occurrences.length - references.length), extractedFromRows: occurrences.length, extractedFromBody: 0,
    noReferenceSamples: pageTraces.filter((t) => !t.extractedReferences.length).slice(0, 12).map((t) => t.finalUrl), failedPageSamples: failed.slice(0, 12).map((item) => `${item.canonicalUrl} · ${item.lastError ?? "Erreur"}`), browseQueueRemaining,
    browseLimitReached: durable.browseLimitReached, productLimitReached: durable.productLimitReached, queueLimitReached: durable.queueLimitReached, discardedUrls: durable.discardedUrls, unvisitedUrls,
    navigationErrors, productErrors, canonicalizedUrls: durable.canonicalizedUrls, duplicateUrlsAvoided: durable.duplicateUrlsAvoided, categoriesDiscovered: durable.categoriesDiscovered, subcategoriesDiscovered: durable.subcategoriesDiscovered,
    matchingPayloadBytes: durable.matchingPayloadBytes,
    crawlCounters: durable.crawlCounters,
    familiesDiscovered: productsQ.length, primaryReferences: (relationCounts.PRIMARY ?? 0) + (relationCounts.PRIMARY_VARIANT ?? 0), accessoryReferences: relationCounts.ACCESSORY ?? 0, optionReferences: relationCounts.OPTION ?? 0,
    relatedProducts: pageTraces.reduce((sum, t) => sum + t.relatedProducts.length, 0), unknownReferences: relationCounts.UNKNOWN ?? 0, scanComplete, partialReasons,
    recentBrowsePages: yieldState.recentProductsPerPage.length,
    recentProductsDiscovered,
    recentDiscoveryYield: yieldState.recentProductsPerPage.length > 0 ? recentProductsDiscovered / yieldState.recentProductsPerPage.length : null,
    consecutiveBrowseWithoutProduct: yieldState.consecutiveWithoutProduct,
    maxConsecutiveBrowseWithoutProduct: yieldState.maxConsecutiveWithoutProduct,
  };
  const m = (kind: string) => matches.filter((item) => item.missingKind === kind).length;
  return { startedAt: (job.startedAt ?? job.createdAt).toISOString(), finishedAt: nowIso(), pagesVisited: browse.filter((item) => item.state === "DONE").length, productPages: productsQ.filter((item) => item.state === "DONE").length, diagnostics,
    totals: { discovered: matches.length, matched: matches.filter((x) => x.status === "matched").length, exact: matches.filter((x) => x.matchMethod === "exact" && ["matched", "already_linked"].includes(x.status)).length, normalized: matches.filter((x) => x.matchMethod === "normalized" && ["matched", "already_linked"].includes(x.status)).length, equivalence: matches.filter((x) => x.matchMethod === "excel" && ["matched", "already_linked"].includes(x.status)).length, suggested: matches.filter((x) => x.status === "suggested").length, missing: matches.filter((x) => x.status === "missing").length, ambiguous: matches.filter((x) => x.status === "ambiguous").length, missingAnalysis: { excelUnmapped: m("excel_unmapped"), referenceClose: m("reference_close"), designationClose: m("designation_close"), familyProbable: m("family_probable"), confirmedMissing: m("confirmed_missing") }, alreadyLinked: matches.filter((x) => x.status === "already_linked").length },
    matches, pageTraces, productLinkTraces: browse.flatMap((item) => json<{ linkTraces?: NonNullable<StockmanCatalogDiscovery["productLinkTraces"]> }>(item.trace, {}).linkTraces ?? []), warnings: [...partialReasons.map((reason) => `Scan PARTIAL : ${reason}.`), ...failed.map((item) => `${item.canonicalUrl} · ${item.lastError ?? "Lecture impossible"}`)].slice(0, 100) };
}

async function reconcile(jobId: string, owner: string, leaseVersion: number) {
  await fenceLease(jobId, owner, leaseVersion);
  const discovery = await buildDiscovery(jobId);
  await prisma.$transaction(async (tx) => {
    const db = tx as unknown as typeof prisma;
    await db.$executeRaw`SELECT pg_advisory_xact_lock(193701, 2)`;
    await fenceLease(jobId, owner, leaseVersion, true, db);
    const job = await db.stockmanDiscoveryJob.findUniqueOrThrow({ where: { id: jobId } });
    const diagnostics = { ...baseDiagnostics(), ...json(job.diagnostics, baseDiagnostics()) };
    const state = diagnostics.reconciling ?? { nextIndex: 0, finishedAt: discovery.finishedAt, newCount: 0, changedCount: 0 };
    discovery.finishedAt = state.finishedAt;
    const end = Math.min(discovery.matches.length, state.nextIndex + 50);
    const stats = await persistStockmanLivingReference(discovery, { offset: state.nextIndex, take: 50, finalize: false, db });
    const next = { ...state, nextIndex: end, newCount: state.newCount + stats.newThisScan, changedCount: state.changedCount + stats.changedThisScan };
    if (end < discovery.matches.length) {
      await db.stockmanDiscoveryJob.update({ where: { id: jobId }, data: {
        diagnostics: { ...diagnostics, reconciling: next } as unknown as Prisma.InputJsonValue,
        progress: { ...json(job.progress, baseProgress()), percent: 99, message: `Réconciliation durable : ${end}/${discovery.matches.length}.`, updatedAt: nowIso() } as Prisma.InputJsonValue,
      } });
      return;
    }
    discovery.livingReference = await persistStockmanLivingReference(discovery, { offset: end, take: 0, finalize: true, db });
    discovery.livingReference.newThisScan = next.newCount;
    discovery.livingReference.changedThisScan = next.changedCount;
    await db.stockmanCatalogSnapshot.updateMany({ where: { finishedAt: new Date(state.finishedAt) }, data: { newCount: next.newCount, changedCount: next.changedCount } });
    discovery.differential = { presentInOyste: discovery.matches.filter((x) => x.catalogueState === "present").length, toImport: discovery.matches.filter((x) => x.catalogueState === "to_import").length, toReview: discovery.matches.filter((x) => x.catalogueState === "to_review").length, disappearedFromStockman: discovery.livingReference.disappearedSincePreviousScan, preparedForImport: discovery.matches.filter((x) => x.importPrepared).length };
    await db.stockmanDiscoveryJob.update({ where: { id: jobId }, data: {
      error: null, status: discovery.diagnostics.scanComplete ? "COMPLETE" : "PARTIAL", phase: "FINISHED", result: discovery as unknown as Prisma.InputJsonValue,
      diagnostics: discovery.diagnostics as unknown as Prisma.InputJsonValue, finishedAt: new Date(state.finishedAt), leaseOwner: null, leaseExpiresAt: null,
      progress: { ...json(job.progress, baseProgress()), phase: "completed", percent: 100, message: discovery.diagnostics.scanComplete ? "Scan certifié complet terminé." : `Scan PARTIAL : ${discovery.diagnostics.partialReasons?.join(" · ") || "preuve stricte de couverture absente"}.`, updatedAt: nowIso() } as Prisma.InputJsonValue,
    } });
  }, { timeout: 25_000 });
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
    const cap = limits(job.options);
    if (job.status === "CANCEL_REQUESTED") {
      await prisma.stockmanDiscoveryQueueItem.updateMany({ where: { jobId: job.id, state: { in: ["PENDING", "PROCESSING"] } }, data: { state: "CANCELLED", leaseOwner: null, leaseExpiresAt: null, claimVersion: null } });
      await prisma.stockmanDiscoveryJob.updateMany({ where: { id: job.id, leaseOwner: owner, leaseVersion }, data: { status: "CANCELLED", phase: "FINISHED", finishedAt: new Date(), leaseOwner: null, leaseExpiresAt: null } });
      return true;
    }

    if (job.phase === "DISCOVERING" || job.phase === "PARSING_PRODUCTS") {
      const c = await counts(job.id);
      if (hasStockmanCrawlWork(c)) {
        return await crawlBatch(job.id, owner, leaseVersion, job.phase as "DISCOVERING" | "PARSING_PRODUCTS", cap);
      }
      await fenceLease(job.id, owner, leaseVersion, true);
      const transitioned = await prisma.stockmanDiscoveryJob.updateMany({
        where: { id: job.id, leaseOwner: owner, leaseVersion },
        data: { phase: "MATCHING" },
      });
      if (transitioned.count !== 1) throw new Error("Lease Stockman perdu : transition vers le matching abandonnée.");
      await updateProgress(job.id, "MATCHING", owner, leaseVersion);
      return true;
    }

    if (job.phase === "MATCHING") return await runMatchingBatch(job.id, owner, leaseVersion);
    if (job.phase === "RECONCILING") {
      await reconcile(job.id, owner, leaseVersion);
      return true;
    }
    return false;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Le scan Stockman a échoué.";
    await prisma.stockmanDiscoveryJob.updateMany({ where: { id: selected.id, leaseOwner: owner, leaseVersion, leaseExpiresAt: { gt: new Date() }, status: { in: ["QUEUED", "RUNNING", "CANCEL_REQUESTED"] } }, data: { error: message, leaseOwner: null, leaseExpiresAt: null } });
    return false;
  } finally {
    await prisma.stockmanDiscoveryJob.updateMany({ where: { id: selected.id, leaseOwner: owner, leaseVersion }, data: { leaseOwner: null, leaseExpiresAt: null } });
  }
}

export async function runStockmanDiscoveryWorkCycle(budgetMs = 45_000) {
  const started = Date.now();
  let batches = 0;
  const maxBatches = 3;
  // A batch contains at most three 12 s navigations and checkpoints after
  // each page. A following batch starts only when at least 39 s remain in the
  // 45 s work budget (36 s navigation ceiling + persistence margin). Fast
  // matching/reconciliation batches can still use all three slots, while a
  // slow crawl batch remains safely below Vercel's 60 s route limit.
  const reserveMs = 39_000;
  const latestSafeStart = Math.max(0, budgetMs - reserveMs);
  while (batches < maxBatches && (batches === 0 || Date.now() - started < latestSafeStart)) {
    const processed = await runNextStockmanDiscoveryBatch();
    if (!processed) break;
    batches += 1;
  }
  return batches;
}

export async function startStockmanDiscoveryJob(options: ScanOptions) {
  const seedUrl = canonicalizeStockmanUrl(options.seedUrl?.trim() || "https://www.stockman.fr/");
  if (!seedUrl) throw new Error("L’URL de départ Stockman est invalide.");
  const normalizedOptions = { ...limits(options), seedUrl, coveragePolicyVersion: 1 };
  const job = await prisma.$transaction(async (tx) => {
    // Serialize scan creation across processes; no migration or in-memory lock.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(193701, 1)`;
    const active = await tx.stockmanDiscoveryJob.findMany({
      where: { status: { in: ["QUEUED", "RUNNING"] } }, orderBy: { createdAt: "desc" },
    });
    const compatible = active.find((item) => {
      const previous = limits(item.options);
      return canonicalizeStockmanUrl(previous.seedUrl || "https://www.stockman.fr/") === seedUrl
        && previous.maxBrowsePages === normalizedOptions.maxBrowsePages
        && previous.maxProductPages === normalizedOptions.maxProductPages;
    });
    if (compatible) return compatible;
    if (seedUrl === "https://www.stockman.fr/" && active.some((item) => canonicalizeStockmanUrl(json<ScanOptions>(item.options, {}).seedUrl || "https://www.stockman.fr/") === seedUrl)) {
      throw new Error("Un scan global STOCKMAN est déjà actif avec d’autres limites. Attendez sa fin ou annulez-le.");
    }
    const created = await tx.stockmanDiscoveryJob.create({ data: { options: normalizedOptions as Prisma.InputJsonValue, progress: baseProgress() as Prisma.InputJsonValue, diagnostics: baseDiagnostics() as Prisma.InputJsonValue, startedAt: new Date() } });
    await tx.stockmanDiscoveryQueueItem.create({ data: { jobId: created.id, canonicalUrl: seedUrl, urlHash: hashUrl(seedUrl), nodeType: "BROWSE", branchKey: "__root__" } });
    return created;
  });
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
