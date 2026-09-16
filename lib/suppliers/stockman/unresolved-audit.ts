import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { normalizeStockmanReference } from "@/lib/suppliers/stockman/equivalence-engine";
import type {
  StockmanCatalogMatch,
  StockmanUnresolvedAudit,
  StockmanUnresolvedAuditRow,
} from "@/lib/suppliers/stockman/types";

type Candidate = {
  targetType: "product" | "variant";
  targetId: string;
  productId: string;
  reference: string;
  name: string;
  category: string;
  sourceData: Prisma.JsonValue | null;
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[×✕]/g, "x")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string | null | undefined) {
  return new Set(normalizeText(value).split(" ").filter((token) => token.length > 2));
}

function textSimilarity(left: string | null | undefined, right: string | null | undefined) {
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

function referenceSimilarity(left: string, right: string) {
  const a = normalizeStockmanReference(left);
  const b = normalizeStockmanReference(right);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const grams = (value: string) => {
    if (value.length < 2) return new Set([value]);
    return new Set(Array.from({ length: value.length - 1 }, (_, index) => value.slice(index, index + 2)));
  };
  const ag = grams(a);
  const bg = grams(b);
  let intersection = 0;
  for (const gram of ag) if (bg.has(gram)) intersection += 1;
  const dice = (2 * intersection) / Math.max(1, ag.size + bg.size);
  const length = 1 - Math.min(1, Math.abs(a.length - b.length) / Math.max(a.length, b.length));
  return Math.min(1, dice * 0.82 + length * 0.18);
}

function stockmanSourceReference(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const stockman = source.stockman;
  if (!stockman || typeof stockman !== "object" || Array.isArray(stockman)) return null;
  const reference = (stockman as Record<string, unknown>).reference;
  return typeof reference === "string" ? reference : null;
}

function uniqueCandidates(items: Candidate[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.targetType}:${item.targetId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toAuditCandidate(candidate: Candidate, referenceScore: number, designationScore: number, categoryScore: number) {
  const score = Math.round((referenceScore * 0.68 + designationScore * 0.24 + categoryScore * 0.08) * 100);
  return {
    targetType: candidate.targetType,
    targetId: candidate.targetId,
    productId: candidate.productId,
    targetReference: candidate.reference,
    targetName: candidate.name,
    category: candidate.category,
    score,
    referenceScore: Math.round(referenceScore * 100),
    designationScore: Math.round(designationScore * 100),
  };
}

export async function auditStockmanUnresolved(items: StockmanCatalogMatch[]): Promise<StockmanUnresolvedAudit> {
  const supplier = await prisma.supplier.findFirst({
    where: {
      OR: [
        { name: { equals: "STOCKMAN", mode: "insensitive" } },
        { slug: { equals: "stockman", mode: "insensitive" } },
        { code: { equals: "STOCKMAN", mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  if (!supplier) throw new Error("Fournisseur STOCKMAN introuvable dans OYSTE.");

  const products = await prisma.product.findMany({
    where: { supplierId: supplier.id },
    select: {
      id: true,
      code: true,
      supplierCode: true,
      name: true,
      sourceData: true,
      category: { select: { path: true, name: true } },
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
  });

  const candidates: Candidate[] = [];
  for (const product of products) {
    const category = product.category?.path || product.category?.name || "";
    const productReference = product.supplierCode?.trim() || product.code.trim();
    if (productReference) {
      candidates.push({
        targetType: "product",
        targetId: product.id,
        productId: product.id,
        reference: productReference,
        name: product.name,
        category,
        sourceData: product.sourceData,
      });
    }
    for (const variant of product.variants) {
      const variantReference = variant.supplierCode?.trim() || variant.code.trim();
      if (!variantReference) continue;
      candidates.push({
        targetType: "variant",
        targetId: variant.id,
        productId: product.id,
        reference: variantReference,
        name: variant.name || product.name,
        category,
        sourceData: variant.sourceData,
      });
    }
  }

  const rows: StockmanUnresolvedAuditRow[] = [];

  for (const item of items) {
    const normalized = normalizeStockmanReference(item.reference);
    const exact = uniqueCandidates(candidates.filter((candidate) => {
      const keys = [
        candidate.reference,
        stockmanSourceReference(candidate.sourceData),
      ].filter((value): value is string => Boolean(value));
      return keys.some((value) => normalizeStockmanReference(value) === normalized);
    }));

    if (exact.length === 1) {
      const candidate = exact[0];
      rows.push({
        reference: item.reference,
        designation: item.designation,
        sourceUrl: item.sourceUrl,
        category: item.category,
        previousState: item.catalogueState ?? "to_review",
        decision: "existing",
        confidence: 100,
        reason: "Référence retrouvée de façon unique dans les produits/variantes STOCKMAN déjà présents dans OYSTE.",
        candidate: toAuditCandidate(candidate, 1, textSimilarity(item.designation, candidate.name), textSimilarity(item.category, candidate.category)),
      });
      continue;
    }

    if (exact.length > 1) {
      // V2.12.5 : une référence STOCKMAN strictement identique existe déjà.
      // Même si OYSTE contient plusieurs objets portant cette référence, il ne
      // faut surtout pas réimporter la référence fournisseur. On la classe
      // comme existante et on signale séparément le doublon interne à nettoyer.
      const rankedExact = exact
        .map((candidate) => ({
          candidate,
          designationScore: textSimilarity(item.designation, candidate.name),
          categoryScore: textSimilarity(item.category, candidate.category),
        }))
        .sort((a, b) => (b.designationScore + b.categoryScore) - (a.designationScore + a.categoryScore));
      const bestExact = rankedExact[0];
      rows.push({
        reference: item.reference,
        designation: item.designation,
        sourceUrl: item.sourceUrl,
        category: item.category,
        previousState: item.catalogueState ?? "to_review",
        decision: "existing",
        confidence: 100,
        reason: `Référence STOCKMAN déjà présente dans OYSTE et portée par ${exact.length} objets : ne pas réimporter. V2.12.6 contrôle séparément s'il s'agit d'une structure parent/variante normale ou d'un vrai doublon.`,
        candidate: toAuditCandidate(bestExact.candidate, 1, bestExact.designationScore, bestExact.categoryScore),
        candidates: exact.slice(0, 5).map((candidate) =>
          toAuditCandidate(candidate, 1, textSimilarity(item.designation, candidate.name), textSimilarity(item.category, candidate.category))),
      });
      continue;
    }

    const ranked = candidates
      .map((candidate) => {
        const referenceScore = referenceSimilarity(item.reference, candidate.reference);
        const designationScore = textSimilarity(item.designation, candidate.name);
        const categoryScore = textSimilarity(item.category, candidate.category);
        return {
          candidate,
          referenceScore,
          designationScore,
          categoryScore,
          combined: referenceScore * 0.68 + designationScore * 0.24 + categoryScore * 0.08,
        };
      })
      .filter((entry) => entry.referenceScore >= 0.58 || entry.designationScore >= 0.42)
      .sort((a, b) => b.combined - a.combined)
      .slice(0, 5);

    const best = ranked[0];
    const second = ranked[1];
    const gap = best && second ? best.combined - second.combined : best ? 1 : 0;

    // V2.12.5 : une référence fournisseur différente reste un article distinct.
    // Une forte ressemblance (accessoire, variante, modèle voisin) ne suffit
    // jamais à déclarer que la référence existe déjà dans OYSTE.

    // V2.12.6 — résolution finale métier :
    // après élimination des correspondances EXACTES ci-dessus, une référence
    // fournisseur différente est un article Stockman distinct. Une proximité
    // de nom/code ne peut plus la bloquer : accessoire, batterie, roue,
    // station de charge, variante, etc. restent des références commerciales
    // autonomes chez le fournisseur.
    const clearlyMissing = true;

    if (clearlyMissing) {
      rows.push({
        reference: item.reference,
        designation: item.designation,
        sourceUrl: item.sourceUrl,
        category: item.category,
        previousState: item.catalogueState ?? "to_review",
        decision: "to_import",
        confidence: best ? Math.max(85, Math.round((1 - best.combined) * 100)) : 100,
        reason: best
          ? "Aucune référence STOCKMAN strictement identique dans OYSTE : référence fournisseur distincte à importer séparément ; les ressemblances avec un parent, accessoire ou modèle voisin ne constituent pas une correspondance."
          : "Aucune référence STOCKMAN strictement identique dans OYSTE : référence fournisseur distincte à importer.",
        candidates: ranked.map((entry) =>
          toAuditCandidate(entry.candidate, entry.referenceScore, entry.designationScore, entry.categoryScore)),
      });
      continue;
    }


  }

  return {
    version: "V2.12.6",
    auditedAt: new Date().toISOString(),
    total: rows.length,
    existing: rows.filter((row) => row.decision === "existing").length,
    toImport: rows.filter((row) => row.decision === "to_import").length,
    ambiguous: rows.filter((row) => row.decision === "ambiguous").length,
    rows,
    dryRun: true,
  };
}
