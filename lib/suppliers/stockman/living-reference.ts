import { prisma } from "@/lib/db/prisma";
import type { StockmanCatalogDiscovery, StockmanLivingReferenceStats } from "@/lib/suppliers/stockman/types";
import { isKnownFalseStockmanReference, knownFalseStockmanReferences } from "@/lib/suppliers/stockman/reference-hygiene";

function changed(previous: { designation: string; category: string | null; sourceUrl: string }, current: { designation: string; category: string | null; sourceUrl: string }) {
  return previous.designation !== current.designation
    || previous.category !== current.category
    || previous.sourceUrl !== current.sourceUrl;
}

export async function persistStockmanLivingReference(discovery: StockmanCatalogDiscovery): Promise<StockmanLivingReferenceStats> {
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

  // V2.8.1 : purge également les anciennes caractéristiques techniques
  // prises pour des références (24V, 20AH, 1665X1170X1900, 1T, etc.).
  const staleCandidates = await prisma.stockmanCatalogReference.findMany({
    select: { reference: true },
  });
  const falseReferences = [...new Set([
    ...knownFalseStockmanReferences(),
    ...staleCandidates.map((item) => item.reference).filter(isKnownFalseStockmanReference),
  ])];
  if (falseReferences.length) {
    await prisma.stockmanCatalogReference.deleteMany({
      where: { reference: { in: falseReferences } },
    });
  }

  const existing = await prisma.stockmanCatalogReference.findMany({
    select: { reference: true, designation: true, category: true, sourceUrl: true, isActive: true, lastSeenAt: true },
  });
  const byReference = new Map(existing.map((item) => [item.reference, item]));
  const currentReferences = new Set(references.map((item) => item.reference));

  let newThisScan = 0;
  let changedThisScan = 0;

  const attempts = discovery.diagnostics.productPageAttempts;
  const failures = discovery.diagnostics.productPageFailures;
  const opened = discovery.diagnostics.productPagesOpened;
  const coverage = attempts > 0 ? opened / attempts : 0;
  const disappearanceCheckSkipped = failures > 0 || coverage < 0.995;
  const disappearanceCheckReason = disappearanceCheckSkipped
    ? `Disparitions non évaluées : scan incomplet (${opened}/${attempts} fiches ouvertes, ${failures} échec(s)).`
    : undefined;

  const disappeared = disappearanceCheckSkipped
    ? []
    : existing.filter((item) => item.isActive && !currentReferences.has(item.reference));

  for (let offset = 0; offset < references.length; offset += 25) {
    const batch = references.slice(offset, offset + 25);
    await Promise.all(batch.map(async (item) => {
      const previous = byReference.get(item.reference);
      const hasChanged = previous ? changed(previous, item) : false;
      if (!previous) newThisScan += 1;
      else if (hasChanged || !previous.isActive) changedThisScan += 1;

      await prisma.stockmanCatalogReference.upsert({
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
          seenCount: { increment: 1 },
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
    await prisma.stockmanCatalogReference.updateMany({
      where: { reference: { in: disappeared.map((item) => item.reference) } },
      data: { isActive: false, lastChangedAt: observedAt },
    });
  }

  await prisma.stockmanCatalogSnapshot.create({
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
