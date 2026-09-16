import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db/prisma";
import { normalizeStockmanReference } from "@/lib/suppliers/stockman/equivalence-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function record(value: Prisma.JsonValue | null) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stockmanMeta(value: Prisma.JsonValue | null) {
  const root = record(value);
  return root.stockman && typeof root.stockman === "object" && !Array.isArray(root.stockman)
    ? (root.stockman as Record<string, unknown>)
    : {};
}

function hasLiveStockmanLink(value: Prisma.JsonValue | null) {
  const meta = stockmanMeta(value);
  return typeof meta.sourceUrl === "string" && meta.sourceUrl.trim().length > 0;
}

function normalizeDesignation(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}


function meaningfulTokens(value: string | null | undefined) {
  const stop = new Set([
    "de", "du", "des", "la", "le", "les", "un", "une", "et", "a", "au", "aux",
    "avec", "pour", "sur", "en", "par", "stockman", "oyste", "kg", "mm", "cm",
  ]);
  return new Set(
    normalizeDesignation(value)
      .split(/\s+/)
      .filter((token) => token.length > 1 && !stop.has(token)),
  );
}

function numericTokens(value: string | null | undefined) {
  return new Set(
    Array.from((value ?? "").matchAll(/\d+(?:[.,]\d+)?/g))
      .map((match) => match[0].replace(",", ".")),
  );
}

function jaccard(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const value of left) if (right.has(value)) shared += 1;
  const union = new Set([...left, ...right]).size;
  return union ? shared / union : 0;
}

function familyPrefix(value: string | null | undefined) {
  const normalized = normalizeStockmanReference(value ?? "");
  const match = normalized.match(/^[A-Z]+/);
  return match?.[0] ?? "";
}

function scoreAmbiguousCandidate(
  livingItem: { reference: string; designation: string; category: string | null; sourceUrl: string },
  candidate: {
    targetType: "product" | "variant";
    code: string;
    supplierCode: string | null;
    name: string;
    parentCode?: string | null;
    parentName?: string | null;
  },
) {
  const livingWords = meaningfulTokens(livingItem.designation);
  const candidateWords = meaningfulTokens(
    [candidate.name, candidate.parentName].filter(Boolean).join(" "),
  );
  const wordScore = jaccard(livingWords, candidateWords);

  const livingNumbers = numericTokens(livingItem.designation);
  const candidateNumbers = numericTokens(
    [candidate.name, candidate.parentName].filter(Boolean).join(" "),
  );
  const numberScore =
    livingNumbers.size > 0
      ? Array.from(livingNumbers).filter((value) => candidateNumbers.has(value)).length /
        livingNumbers.size
      : 0.5;

  const livingFamily = familyPrefix(livingItem.reference);
  const candidateFamilies = [
    familyPrefix(candidate.supplierCode),
    familyPrefix(candidate.code),
    familyPrefix(candidate.parentCode),
  ].filter(Boolean);
  const familyScore =
    livingFamily && candidateFamilies.some((value) => value === livingFamily) ? 1 : 0;

  // Sur une ligne commerciale Stockman, une variante est en général une meilleure
  // cible qu'un parent produit si les autres signaux sont équivalents.
  const typeScore = candidate.targetType === "variant" ? 1 : 0.65;

  const exactName =
    normalizeDesignation(livingItem.designation) === normalizeDesignation(candidate.name)
      ? 1
      : 0;

  const score =
    wordScore * 0.42 +
    numberScore * 0.24 +
    familyScore * 0.18 +
    exactName * 0.11 +
    typeScore * 0.05;

  return {
    score: Math.round(score * 1000) / 1000,
    details: {
      wordScore: Math.round(wordScore * 1000) / 1000,
      numberScore: Math.round(numberScore * 1000) / 1000,
      familyScore,
      exactName,
      typeScore,
    },
  };
}

function hasPurchasePrice(value: Prisma.JsonValue | null) {
  const meta = stockmanMeta(value);
  return typeof meta.purchasePriceExVat === "number" && Number.isFinite(meta.purchasePriceExVat) && meta.purchasePriceExVat > 0;
}

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== "ACTIVE") {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }

  const supplier = await prisma.supplier.findFirst({
    where: { name: { equals: "STOCKMAN", mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (!supplier) {
    return NextResponse.json({ message: "Fournisseur STOCKMAN introuvable." }, { status: 404 });
  }

  const [products, living, drafts] = await Promise.all([
    prisma.product.findMany({
      where: { supplierId: supplier.id },
      select: {
        id: true,
        code: true,
        supplierCode: true,
        name: true,
        publicationStatus: true,
        sourceData: true,
        variants: {
          select: {
            id: true,
            code: true,
            supplierCode: true,
            name: true,
            sourceData: true,
          },
        },
      },
      orderBy: { code: "asc" },
    }),
    prisma.stockmanCatalogReference.findMany({
      select: {
        reference: true,
        designation: true,
        category: true,
        sourceUrl: true,
        isActive: true,
        targetType: true,
        targetId: true,
        productId: true,
        lastMatchStatus: true,
      },
    }),
    prisma.stockmanImportDraft.count(),
  ]);

  const productRows = products.map((product) => ({
    ...product,
    liveLinked: hasLiveStockmanLink(product.sourceData),
    hasPurchasePrice: hasPurchasePrice(product.sourceData),
  }));
  const variants = products.flatMap((product) =>
    product.variants.map((variant) => ({
      ...variant,
      productId: product.id,
      productCode: product.code,
      liveLinked: hasLiveStockmanLink(variant.sourceData),
      hasPurchasePrice: hasPurchasePrice(variant.sourceData),
    })),
  );

  const activeLiving = living.filter((item) => item.isActive);
  const activeLinked = activeLiving.filter((item) => item.targetId && item.targetType);
  const activeUnlinked = activeLiving.filter((item) => !item.targetId || !item.targetType);
  const inactiveLiving = living.filter((item) => !item.isActive);


  const allCurrent = [
    ...productRows.map((item) => ({
      targetType: "product" as const,
      targetId: item.id,
      code: item.code,
      supplierCode: item.supplierCode,
      name: item.name,
      parentCode: null as string | null,
      parentName: null as string | null,
      liveLinked: item.liveLinked,
    })),
    ...variants.map((item) => {
      const parent = productRows.find((product) => product.id === item.productId);
      return {
        targetType: "variant" as const,
        targetId: item.id,
        code: item.code,
        supplierCode: item.supplierCode,
        name: item.name,
        parentCode: parent?.code ?? item.productCode ?? null,
        parentName: parent?.name ?? null,
        liveLinked: item.liveLinked,
      };
    }),
  ];

  const byExactReference = new Map<string, typeof allCurrent>();
  const byNormalizedReference = new Map<string, typeof allCurrent>();
  const byDesignation = new Map<string, typeof allCurrent>();
  for (const item of allCurrent) {
    for (const raw of [item.supplierCode, item.code]) {
      const exact = (raw ?? "").trim().toUpperCase();
      if (exact) byExactReference.set(exact, [...(byExactReference.get(exact) ?? []), item]);
      const normalized = normalizeStockmanReference(raw ?? "");
      if (normalized.length >= 3) byNormalizedReference.set(normalized, [...(byNormalizedReference.get(normalized) ?? []), item]);
    }
    const designation = normalizeDesignation(item.name);
    if (designation.length >= 8) byDesignation.set(designation, [...(byDesignation.get(designation) ?? []), item]);
  }

  const resolution = activeUnlinked.map((livingItem) => {
    const exactKey = livingItem.reference.trim().toUpperCase();
    const normalizedKey = normalizeStockmanReference(livingItem.reference);
    const designationKey = normalizeDesignation(livingItem.designation);
    const exact = byExactReference.get(exactKey) ?? [];
    const normalized = byNormalizedReference.get(normalizedKey) ?? [];
    const named = byDesignation.get(designationKey) ?? [];
    const unique = (items: typeof allCurrent) => Array.from(new Map(items.map((item) => [item.targetId, item])).values());
    const exactUnique = unique(exact);
    const normalizedUnique = unique(normalized);
    const namedUnique = unique(named);

    if (exactUnique.length === 1) return { bucket: "CERTAIN", reason: "Référence exacte", livingItem, candidate: exactUnique[0] };
    if (normalizedUnique.length === 1) return { bucket: "CERTAIN", reason: "Référence normalisée unique", livingItem, candidate: normalizedUnique[0] };
    if (exactUnique.length > 1 || normalizedUnique.length > 1) {
      const candidates = unique([...exactUnique, ...normalizedUnique]);
      const ranked = candidates
        .map((candidate) => ({
          candidate,
          ...scoreAmbiguousCandidate(livingItem, candidate),
        }))
        .sort((a, b) => b.score - a.score);
      const best = ranked[0];
      const second = ranked[1];
      const gap = best ? best.score - (second?.score ?? 0) : 0;

      if (best && best.score >= 0.72 && gap >= 0.12) {
        return {
          bucket: "CERTAIN",
          reason: `Ambiguïté levée par contexte (${Math.round(best.score * 100)} %, écart ${Math.round(gap * 100)} pts)`,
          livingItem,
          candidate: best.candidate,
          ambiguityResolved: true,
          ranking: ranked.slice(0, 5),
        };
      }

      return {
        bucket: "AMBIGUOUS",
        reason: "Plusieurs objets OYSTE portent cette référence et le contexte ne permet pas de trancher avec assez de sécurité",
        livingItem,
        candidates: candidates.slice(0, 8),
        ranking: ranked.slice(0, 5),
      };
    }
    if (namedUnique.length === 1) return { bucket: "PROBABLE", reason: "Désignation exacte unique", livingItem, candidate: namedUnique[0] };
    if (namedUnique.length > 1) {
      const ranked = namedUnique
        .map((candidate) => ({
          candidate,
          ...scoreAmbiguousCandidate(livingItem, candidate),
        }))
        .sort((a, b) => b.score - a.score);
      const best = ranked[0];
      const second = ranked[1];
      const gap = best ? best.score - (second?.score ?? 0) : 0;

      if (best && best.score >= 0.78 && gap >= 0.14) {
        return {
          bucket: "PROBABLE",
          reason: `Désignation ambiguë départagée par contexte (${Math.round(best.score * 100)} %)`,
          livingItem,
          candidate: best.candidate,
          ambiguityResolved: true,
          ranking: ranked.slice(0, 5),
        };
      }

      return {
        bucket: "AMBIGUOUS",
        reason: "Désignation partagée par plusieurs objets, score insuffisant pour trancher automatiquement",
        livingItem,
        candidates: namedUnique.slice(0, 8),
        ranking: ranked.slice(0, 5),
      };
    }
    return { bucket: "NEW", reason: "Aucun objet OYSTE correspondant trouvé", livingItem };
  });

  const counts = {
    certain: resolution.filter((item) => item.bucket === "CERTAIN").length,
    probable: resolution.filter((item) => item.bucket === "PROBABLE").length,
    newFromStockman: resolution.filter((item) => item.bucket === "NEW").length,
    ambiguous: resolution.filter((item) => item.bucket === "AMBIGUOUS").length,
    ambiguitiesResolvedByContext: resolution.filter(
      (item) => "ambiguityResolved" in item && item.ambiguityResolved === true,
    ).length,
  };
  const matchedTargetIds = new Set(
    resolution.flatMap((item) => "candidate" in item && item.candidate ? [item.candidate.targetId] : []),
  );
  const orphanLegacy = allCurrent.filter((item) => !item.liveLinked && !matchedTargetIds.has(item.targetId));

  // Pour le dry-run, "legacy" signifie : objet STOCKMAN actuellement en BDD
  // qui n'est pas encore directement relié au catalogue vivant via sourceUrl.
  // On ne supprime rien ici.
  const legacyProducts = productRows.filter((item) => !item.liveLinked);
  const legacyVariants = variants.filter((item) => !item.liveLinked);
  const liveProducts = productRows.filter((item) => item.liveLinked);
  const liveVariants = variants.filter((item) => item.liveLinked);

  const familyKeys = new Set(
    activeLiving.map((item) => {
      try {
        const pathname = new URL(item.sourceUrl).pathname;
        return pathname || item.sourceUrl;
      } catch {
        return item.sourceUrl;
      }
    }),
  );

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    supplier,
    mode: "DRY_RUN",
    destructiveActionPerformed: false,
    currentCatalogue: {
      products: productRows.length,
      variants: variants.length,
      publishedProducts: productRows.filter((item) => item.publicationStatus === "PUBLISHED").length,
      liveLinkedProducts: liveProducts.length,
      liveLinkedVariants: liveVariants.length,
      legacyProducts: legacyProducts.length,
      legacyVariants: legacyVariants.length,
      productsWithPurchasePrice: productRows.filter((item) => item.hasPurchasePrice).length,
      variantsWithPurchasePrice: variants.filter((item) => item.hasPurchasePrice).length,
    },
    livingCatalogue: {
      totalKnown: living.length,
      activeReferences: activeLiving.length,
      inactiveReferences: inactiveLiving.length,
      linkedActiveReferences: activeLinked.length,
      unlinkedActiveReferences: activeUnlinked.length,
      estimatedFamiliesByUrl: familyKeys.size,
      importDrafts: drafts,
    },
    rebuildProjection: {
      stockmanObjectsPotentiallyRemoved: legacyProducts.length + legacyVariants.length,
      liveReferencesToRebuildFrom: activeLiving.length,
      liveReferencesAlreadyLinked: activeLinked.length,
      liveReferencesStillToResolve: activeUnlinked.length,
      warning:
        "Projection uniquement. Aucun DELETE, UPDATE ou import n'est exécuté par cet audit.",
    },
    resolutionAnalysis: {
      ...counts,
      resolvableAutomatically: counts.certain,
      requiresReview: counts.probable + counts.ambiguous,
      legacyWithoutLivingMatch: orphanLegacy.length,
      safeToExecuteRebuild: counts.ambiguous === 0,
    },
    resolutionSamples: {
      certain: resolution.filter((item) => item.bucket === "CERTAIN").slice(0, 20),
      probable: resolution.filter((item) => item.bucket === "PROBABLE").slice(0, 20),
      newFromStockman: resolution.filter((item) => item.bucket === "NEW").slice(0, 20),
      ambiguous: resolution.filter((item) => item.bucket === "AMBIGUOUS").slice(0, 20),
      ambiguitiesResolved: resolution
        .filter((item) => "ambiguityResolved" in item && item.ambiguityResolved === true)
        .slice(0, 20),
      orphanLegacy: orphanLegacy.slice(0, 20).map((item) => ({ code: item.code, supplierCode: item.supplierCode, name: item.name, targetType: item.targetType })),
    },
    samples: {
      legacyProducts: legacyProducts.slice(0, 20).map((item) => ({
        code: item.code,
        supplierCode: item.supplierCode,
        name: item.name,
        variants: item.variants.length,
      })),
      legacyVariants: legacyVariants.slice(0, 20).map((item) => ({
        code: item.code,
        supplierCode: item.supplierCode,
        name: item.name,
        productCode: item.productCode,
      })),
      unlinkedLivingReferences: activeUnlinked.slice(0, 20).map((item) => ({
        reference: item.reference,
        designation: item.designation,
        category: item.category,
        sourceUrl: item.sourceUrl,
        lastMatchStatus: item.lastMatchStatus,
      })),
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
