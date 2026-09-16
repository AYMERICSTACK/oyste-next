import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { scanStockmanCatalog, type StockmanCatalogScanProgress } from "@/lib/suppliers/stockman/catalog-scanner";
import { createStockmanEquivalenceMatcher, type StockmanMatchCandidate } from "@/lib/suppliers/stockman/equivalence-engine";
import { persistStockmanLivingReference } from "@/lib/suppliers/stockman/living-reference";
import type {
  StockmanCatalogDiscovery,
  StockmanDiscoveryJobProgress,
  StockmanDiscoveryJobStatus,
} from "@/lib/suppliers/stockman/types";

type ScanOptions = {
  seedUrl?: string;
  maxBrowsePages?: number;
  maxProductPages?: number;
};

type InternalJob = StockmanDiscoveryJobStatus & { expiresAt: number };

declare global {
  // eslint-disable-next-line no-var
  var __oysteStockmanDiscoveryJobs: Map<string, InternalJob> | undefined;
}

const jobs = globalThis.__oysteStockmanDiscoveryJobs ?? new Map<string, InternalJob>();
globalThis.__oysteStockmanDiscoveryJobs = jobs;

const JOB_TTL_MS = 2 * 60 * 60 * 1000;

function now() {
  return new Date().toISOString();
}

function cleanupJobs() {
  const timestamp = Date.now();
  for (const [jobId, job] of jobs) {
    if (job.expiresAt < timestamp) jobs.delete(jobId);
  }
}

function baseProgress(): StockmanDiscoveryJobProgress {
  return {
    phase: "queued",
    percent: 0,
    message: "Scan en attente de démarrage…",
    pagesVisited: 0,
    productUrlsFound: 0,
    productPagesProcessed: 0,
    referencesFound: 0,
    failures: 0,
    updatedAt: now(),
  };
}

function progressFromScanner(progress: StockmanCatalogScanProgress): StockmanDiscoveryJobProgress {
  const productTotal = Math.max(progress.productUrlsFound, 1);
  const percent = progress.phase === "catalogue"
    ? Math.min(20, Math.max(2, Math.round(progress.pagesVisited / 6)))
    : Math.min(92, 20 + Math.round((progress.productPagesProcessed / productTotal) * 72));

  return {
    phase: progress.phase,
    percent,
    message: progress.phase === "catalogue"
      ? `Exploration du catalogue : ${progress.pagesVisited} page(s), ${progress.productUrlsFound} fiche(s) détectée(s).`
      : `Lecture des fiches : ${progress.productPagesProcessed}/${progress.productUrlsFound} · ${progress.referencesFound} référence(s).`,
    pagesVisited: progress.pagesVisited,
    productUrlsFound: progress.productUrlsFound,
    productPagesProcessed: progress.productPagesProcessed,
    referencesFound: progress.referencesFound,
    failures: progress.failures,
    updatedAt: now(),
  };
}

function setProgress(jobId: string, progress: StockmanDiscoveryJobProgress) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.progress = progress;
  job.expiresAt = Date.now() + JOB_TTL_MS;
}

async function buildDiscovery(jobId: string, options: ScanOptions): Promise<StockmanCatalogDiscovery> {
  const scan = await scanStockmanCatalog({
    ...options,
    onProgress: (progress) => setProgress(jobId, progressFromScanner(progress)),
  });

  setProgress(jobId, {
    phase: "matching",
    percent: 95,
    message: `Rapprochement de ${scan.references.length} référence(s) avec le catalogue OYSTE…`,
    pagesVisited: scan.pagesVisited,
    productUrlsFound: scan.diagnostics.uniqueProductUrls,
    productPagesProcessed: scan.diagnostics.productPageAttempts,
    referencesFound: scan.references.length,
    failures: scan.diagnostics.productPageFailures,
    updatedAt: now(),
  });

  const [products, variants, importDrafts] = await Promise.all([
    prisma.product.findMany({ select: { id: true, name: true, supplierCode: true, sourceData: true } }),
    prisma.productVariant.findMany({ select: { id: true, productId: true, name: true, supplierCode: true, sourceData: true } }),
    prisma.stockmanImportDraft.findMany({ where: { status: "PREPARED" }, select: { reference: true } }),
  ]);

  const candidates: StockmanMatchCandidate[] = [];
  for (const product of products) {
    const supplierCode = product.supplierCode?.trim();
    if (!supplierCode) continue;
    candidates.push({
      targetType: "product",
      targetId: product.id,
      productId: product.id,
      targetName: product.name,
      supplierCode,
      sourceData: product.sourceData,
    });
  }
  for (const variant of variants) {
    const supplierCode = variant.supplierCode?.trim();
    if (!supplierCode) continue;
    candidates.push({
      targetType: "variant",
      targetId: variant.id,
      productId: variant.productId,
      targetName: variant.name,
      supplierCode,
      sourceData: variant.sourceData,
    });
  }

  const matcher = createStockmanEquivalenceMatcher(candidates);
  const preparedReferences = new Set(importDrafts.map((item) => item.reference.trim().toUpperCase()));
  const matches = scan.references.map(matcher.match).map((match) => ({
    ...match,
    catalogueState: match.status === "matched" || match.status === "already_linked"
      ? "present" as const
      : match.status === "missing" && match.missingKind === "confirmed_missing"
        ? "to_import" as const
        : "to_review" as const,
    importPrepared: preparedReferences.has(match.reference.trim().toUpperCase()),
  }));

  const discovery: StockmanCatalogDiscovery = {
    startedAt: scan.startedAt,
    finishedAt: scan.finishedAt,
    pagesVisited: scan.pagesVisited,
    productPages: scan.productPages,
    diagnostics: scan.diagnostics,
    totals: {
      discovered: matches.length,
      matched: matches.filter((item) => item.status === "matched").length,
      exact: matches.filter((item) => item.matchMethod === "exact" && (item.status === "matched" || item.status === "already_linked")).length,
      normalized: matches.filter((item) => item.matchMethod === "normalized" && (item.status === "matched" || item.status === "already_linked")).length,
      equivalence: matches.filter((item) => item.matchMethod === "excel" && (item.status === "matched" || item.status === "already_linked")).length,
      suggested: matches.filter((item) => item.status === "suggested").length,
      missing: matches.filter((item) => item.status === "missing").length,
      ambiguous: matches.filter((item) => item.status === "ambiguous").length,
      missingAnalysis: {
        excelUnmapped: matches.filter((item) => item.missingKind === "excel_unmapped").length,
        referenceClose: matches.filter((item) => item.missingKind === "reference_close").length,
        designationClose: matches.filter((item) => item.missingKind === "designation_close").length,
        familyProbable: matches.filter((item) => item.missingKind === "family_probable").length,
        confirmedMissing: matches.filter((item) => item.missingKind === "confirmed_missing").length,
      },
      alreadyLinked: matches.filter((item) => item.status === "already_linked").length,
    },
    matches,
    warnings: scan.warnings,
  };

  setProgress(jobId, {
    phase: "matching",
    percent: 98,
    message: "Mise à jour du référentiel Stockman vivant…",
    pagesVisited: scan.pagesVisited,
    productUrlsFound: scan.diagnostics.uniqueProductUrls,
    productPagesProcessed: scan.diagnostics.productPageAttempts,
    referencesFound: scan.references.length,
    failures: scan.diagnostics.productPageFailures,
    updatedAt: now(),
  });

  discovery.livingReference = await persistStockmanLivingReference(discovery);
  discovery.differential = {
    presentInOyste: matches.filter((item) => item.catalogueState === "present").length,
    toImport: matches.filter((item) => item.catalogueState === "to_import").length,
    toReview: matches.filter((item) => item.catalogueState === "to_review").length,
    disappearedFromStockman: discovery.livingReference.disappearedSincePreviousScan,
    preparedForImport: matches.filter((item) => item.importPrepared).length,
  };
  return discovery;
}

async function executeJob(jobId: string, options: ScanOptions) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = "running";
  job.startedAt = now();
  job.progress = { ...baseProgress(), phase: "catalogue", percent: 1, message: "Ouverture de Stockman…", updatedAt: now() };

  try {
    const result = await buildDiscovery(jobId, options);
    const current = jobs.get(jobId);
    if (!current) return;
    current.status = "completed";
    current.finishedAt = now();
    current.result = result;
    current.progress = {
      phase: "completed",
      percent: 100,
      message: `Scan terminé : ${result.totals.discovered} référence(s) analysée(s).`,
      pagesVisited: result.pagesVisited,
      productUrlsFound: result.diagnostics.uniqueProductUrls,
      productPagesProcessed: result.diagnostics.productPageAttempts,
      referencesFound: result.totals.discovered,
      failures: result.diagnostics.productPageFailures,
      updatedAt: now(),
    };
    current.expiresAt = Date.now() + JOB_TTL_MS;
  } catch (error) {
    const current = jobs.get(jobId);
    if (!current) return;
    const message = error instanceof Error ? error.message : "Le scan Stockman a échoué.";
    current.status = "failed";
    current.finishedAt = now();
    current.error = message;
    current.progress = {
      ...current.progress,
      phase: "failed",
      percent: current.progress.percent,
      message,
      updatedAt: now(),
    };
    current.expiresAt = Date.now() + JOB_TTL_MS;
  }
}

export function startStockmanDiscoveryJob(options: ScanOptions) {
  cleanupJobs();
  const jobId = randomUUID();
  const createdAt = now();
  jobs.set(jobId, {
    jobId,
    status: "queued",
    createdAt,
    startedAt: null,
    finishedAt: null,
    progress: baseProgress(),
    expiresAt: Date.now() + JOB_TTL_MS,
  });

  // Le connecteur Stockman tourne sur le serveur Node/intranet OYSTE. Le job
  // est volontairement détaché de la requête HTTP afin d'éviter les timeouts
  // navigateur pendant les scans Playwright de plusieurs minutes.
  void executeJob(jobId, options);
  return getStockmanDiscoveryJob(jobId)!;
}

export function getStockmanDiscoveryJob(jobId: string): StockmanDiscoveryJobStatus | null {
  cleanupJobs();
  const job = jobs.get(jobId);
  if (!job) return null;
  const { expiresAt: _expiresAt, ...publicJob } = job;
  return publicJob;
}
