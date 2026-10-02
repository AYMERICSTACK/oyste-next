import { prisma } from "@/lib/db/prisma";
import type { StockmanCatalogDiscovery, StockmanLivingReferenceStats } from "@/lib/suppliers/stockman/types";
import { isKnownFalseStockmanReference, knownFalseStockmanReferences } from "@/lib/suppliers/stockman/reference-hygiene";
import { hasProvenCompleteStockmanScan } from "@/lib/suppliers/stockman/scan-completeness";

function changed(previous: { designation: string; category: string | null; sourceUrl: string }, current: { designation: string; category: string | null; sourceUrl: string }) {
  return previous.designation !== current.designation
    || previous.category !== current.category
    || previous.sourceUrl !== current.sourceUrl;
}

export async function persistStockmanLivingReference(
  discovery: StockmanCatalogDiscovery,
  options: { offset?: number; take?: number; finalize?: boolean; db?: typeof prisma } = {},
): Promise<StockmanLivingReferenceStats> {
  const db = options.db ?? prisma;
  const finalize = options.finalize !== false;
  const observedAt = new Date(discovery.finishedAt);
  const references = discovery.matches
    .filter((match) => !isKnownFalseStockmanReference(match.reference))
    .map((match) => ({
      reference: match.reference.trim().toUpperCase(),
      designation: match.designation,
      category: match.category,
      sourceUrl: match.sourceUrl,
      match,
    }));

  const start = options.offset ?? 0;
  const end = Math.min(references.length, start + (options.take ?? references.length));

  // V2.8.1 : purge également les anciennes caractéristiques techniques
  // prises pour des références (24V, 20AH, 1665X1170X1900, 1T, etc.).
  const staleCandidates = finalize ? await db.stockmanCatalogReference.findMany({
    select: { reference: true },
  }) : [];
  const falseReferences = [...new Set([
    ...knownFalseStockmanReferences(),
    ...staleCandidates.map((item) => item.reference).filter(isKnownFalseStockmanReference),
  ])];
  if (finalize && falseReferences.length) {
    await db.stockmanCatalogReference.deleteMany({
      where: { reference: { in: falseReferences } },
    });
  }

  const existing = await db.stockmanCatalogReference.findMany({
    ...(!finalize ? { where: { reference: { in: references.slice(start, end).map((item) => item.reference) } } } : {}),
    select: { reference: true, designation: true, category: true, sourceUrl: true, isActive: true, lastSeenAt: true },
  });
  const byReference = new Map(existing.map((item) => [item.reference, item]));
  const currentReferences = new Set(references.map((item) => item.reference));

  let newThisScan = 0;
  let changedThisScan = 0;

  const attempts = discovery.diagnostics.uniqueProductUrls;
  const failures = discovery.diagnostics.productPageFailures;
  const opened = discovery.diagnostics.productPagesOpened;
  const coverage = attempts > 0 ? opened / attempts : 0;
  const browseLimitReached = discovery.diagnostics.browseLimitReached === true;
  const productLimitReached = discovery.diagnostics.productLimitReached === true;
  const scanExplicitlyComplete = hasProvenCompleteStockmanScan(discovery.diagnostics);

  // Sécurité catalogue : une absence n'est exploitable que si le scanner a
  // explicitement prouvé que le parcours était complet. Une information de
  // complétude absente, un plafond atteint ou une fiche non ouverte bloque
  // toute désactivation, tout en laissant les références observées être
  // créées, mises à jour ou réactivées normalement.
  const disappearanceCheckSkipped = !scanExplicitlyComplete
    || browseLimitReached
    || productLimitReached
    || failures > 0
    || !Number.isFinite(coverage)
    || coverage !== 1;

  const incompleteReasons = [
    !scanExplicitlyComplete ? "complétude non confirmée" : null,
    browseLimitReached ? "plafond de navigation atteint" : null,
    productLimitReached ? "plafond de fiches atteint" : null,
    failures > 0 ? `${failures} échec(s) de fiche` : null,
    coverage !== 1 ? `${opened}/${attempts} fiches ouvertes` : null,
  ].filter((reason): reason is string => Boolean(reason));

  const disappearanceCheckReason = disappearanceCheckSkipped
    ? `Disparitions non évaluées : scan non prouvé complet (${incompleteReasons.join(", ")}).`
    : undefined;

  const disappeared = !finalize || disappearanceCheckSkipped
    ? []
    : existing.filter((item) => item.isActive && item.lastSeenAt <= observedAt && !currentReferences.has(item.reference));

  for (let offset = start; offset < end; offset += 25) {
    const batch = references.slice(offset, Math.min(offset + 25, end));
    await Promise.all(batch.map(async (item) => {
      const previous = byReference.get(item.reference);
      if (previous && previous.lastSeenAt > observedAt) return;
      const hasChanged = previous ? changed(previous, item) : false;
      if (!previous) newThisScan += 1;
      else if (hasChanged || !previous.isActive) changedThisScan += 1;

      await db.stockmanCatalogReference.upsert({
        where: { reference: item.reference },
        create: {
          reference: item.reference,
          designation: item.designation,
          category: item.category,
          sourceUrl: item.sourceUrl,
          firstSeenAt: observedAt,
          lastSeenAt: observedAt,
          lastChangedAt: observedAt,
          seenCount: 1,
          isActive: true,
          lastMatchStatus: item.match.status,
          lastMatchMethod: item.match.matchMethod,
          lastConfidence: item.match.confidence,
          lastMissingKind: item.match.missingKind ?? null,
          targetType: item.match.targetType ?? null,
          targetId: item.match.targetId ?? null,
          productId: item.match.productId ?? null,
          targetReference: item.match.targetReference ?? null,
        },
        update: {
          designation: item.designation,
          category: item.category,
          sourceUrl: item.sourceUrl,
          lastSeenAt: observedAt,
          lastChangedAt: hasChanged || !previous?.isActive ? observedAt : undefined,
          seenCount: previous?.lastSeenAt.getTime() === observedAt.getTime() ? undefined : { increment: 1 },
          isActive: true,
          lastMatchStatus: item.match.status,
          lastMatchMethod: item.match.matchMethod,
          lastConfidence: item.match.confidence,
          lastMissingKind: item.match.missingKind ?? null,
          targetType: item.match.targetType ?? null,
          targetId: item.match.targetId ?? null,
          productId: item.match.productId ?? null,
          targetReference: item.match.targetReference ?? null,
        },
      });
    }));
  }

  if (disappeared.length) {
    await db.stockmanCatalogReference.updateMany({
      where: { reference: { in: disappeared.map((item) => item.reference) }, lastSeenAt: { lte: observedAt } },
      data: { isActive: false, lastChangedAt: observedAt },
    });
  }

  if (finalize) await db.stockmanCatalogSnapshot.create({
    data: {
      startedAt: new Date(discovery.startedAt),
      finishedAt: observedAt,
      referencesCount: references.length,
      pagesVisited: discovery.pagesVisited,
      productPages: discovery.productPages,
      newCount: newThisScan,
      changedCount: changedThisScan,
      disappearedCount: disappeared.length,
    },
  });

  return {
    totalKnown: existing.length + newThisScan,
    seenThisScan: references.length,
    newThisScan,
    changedThisScan,
    disappearedSincePreviousScan: disappeared.length,
    disappearanceCheckSkipped,
    disappearanceCheckReason,
    disappearedReferences: disappeared.slice(0, 100).map((item) => ({
      reference: item.reference,
      designation: item.designation,
      sourceUrl: item.sourceUrl,
      lastSeenAt: item.lastSeenAt.toISOString(),
    })),
  };
}
