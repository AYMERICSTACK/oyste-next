import { prisma } from "@/lib/db/prisma";
import { normalizeStockmanReference } from "@/lib/suppliers/stockman/equivalence-engine";
import type {
  StockmanDuplicateStructureAudit,
  StockmanDuplicateStructureRow,
  StockmanDuplicateStructureObject,
} from "@/lib/suppliers/stockman/types";

function decimal(value: unknown) {
  if (value === null || value === undefined) return null;
  const n = Number(String(value));
  return Number.isFinite(n) ? n : null;
}

function richnessScore(item: StockmanDuplicateStructureObject) {
  return (
    (item.mediaCount > 0 ? 4 : 0)
    + (item.documentCount > 0 ? 3 : 0)
    + (item.featureCount > 0 ? 2 : 0)
    + (item.hasSourceData ? 2 : 0)
    + (item.category ? 1 : 0)
    + (item.priceHt !== null && item.priceHt > 0 ? 1 : 0)
    + (item.weightKg !== null && item.weightKg > 0 ? 1 : 0)
  );
}

export async function auditStockmanDuplicateStructure(references: string[]): Promise<StockmanDuplicateStructureAudit> {
  const normalizedRefs = [...new Set(references.map((value) => normalizeStockmanReference(value)).filter(Boolean))];

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
      priceHt: true,
      stock: true,
      weightKg: true,
      sourceData: true,
      publicationStatus: true,
      category: { select: { path: true, name: true } },
      _count: { select: { media: true, documents: true, features: true, variants: true } },
      variants: {
        select: {
          id: true,
          code: true,
          supplierCode: true,
          name: true,
          priceHt: true,
          stock: true,
          weightKg: true,
          sourceData: true,
          _count: { select: { features: true } },
        },
      },
    },
  });

  const rows: StockmanDuplicateStructureRow[] = [];

  for (const reference of normalizedRefs) {
    const objects: StockmanDuplicateStructureObject[] = [];

    for (const product of products) {
      const productRef = normalizeStockmanReference(product.supplierCode || product.code);
      if (productRef === reference) {
        objects.push({
          targetType: "product",
          targetId: product.id,
          productId: product.id,
          reference: product.supplierCode || product.code,
          name: product.name,
          category: product.category?.path || product.category?.name || "",
          publicationStatus: product.publicationStatus,
          mediaCount: product._count.media,
          documentCount: product._count.documents,
          featureCount: product._count.features,
          variantCount: product._count.variants,
          hasSourceData: Boolean(product.sourceData),
          priceHt: decimal(product.priceHt),
          stock: product.stock,
          weightKg: decimal(product.weightKg),
        });
      }

      for (const variant of product.variants) {
        const variantRef = normalizeStockmanReference(variant.supplierCode || variant.code);
        if (variantRef !== reference) continue;
        objects.push({
          targetType: "variant",
          targetId: variant.id,
          productId: product.id,
          reference: variant.supplierCode || variant.code,
          name: variant.name || product.name,
          category: product.category?.path || product.category?.name || "",
          publicationStatus: product.publicationStatus,
          mediaCount: product._count.media,
          documentCount: product._count.documents,
          featureCount: variant._count.features,
          variantCount: 0,
          hasSourceData: Boolean(variant.sourceData),
          priceHt: decimal(variant.priceHt),
          stock: variant.stock,
          weightKg: decimal(variant.weightKg),
        });
      }
    }

    const productIds = new Set(objects.map((item) => item.productId));
    const productsOnly = objects.filter((item) => item.targetType === "product");
    const variantsOnly = objects.filter((item) => item.targetType === "variant");

    let classification: StockmanDuplicateStructureRow["classification"];
    let reason: string;

    if (
      objects.length === 2
      && productIds.size === 1
      && productsOnly.length === 1
      && variantsOnly.length === 1
    ) {
      classification = "parent_variant_structure";
      reason = "Même référence portée par le produit parent et une variante du même produit : structure catalogue parent/variante cohérente, aucune suppression à effectuer.";
    } else if (objects.length > 1 && productIds.size > 1) {
      classification = "real_duplicate";
      reason = "La même référence STOCKMAN est portée par plusieurs produits parents différents : vrai doublon OYSTE à examiner avant nettoyage.";
    } else if (objects.length > 1) {
      classification = "same_product_duplicate";
      reason = "Plusieurs objets du même produit portent la référence ; structure inhabituelle à contrôler avant toute suppression.";
    } else {
      classification = "not_duplicate";
      reason = objects.length === 1
        ? "Une seule occurrence actuelle retrouvée : aucun doublon structurel."
        : "Aucune occurrence actuelle retrouvée pour cette référence.";
    }

    const ranked = [...objects].sort((a, b) => richnessScore(b) - richnessScore(a));
    rows.push({
      reference,
      classification,
      reason,
      objectCount: objects.length,
      productCount: productIds.size,
      recommendedKeepTargetId: classification === "real_duplicate" ? ranked[0]?.targetId ?? null : null,
      objects,
    });
  }

  return {
    version: "V2.12.6",
    auditedAt: new Date().toISOString(),
    totalReferences: rows.length,
    parentVariantStructures: rows.filter((row) => row.classification === "parent_variant_structure").length,
    realDuplicates: rows.filter((row) => row.classification === "real_duplicate").length,
    sameProductDuplicates: rows.filter((row) => row.classification === "same_product_duplicate").length,
    notDuplicates: rows.filter((row) => row.classification === "not_duplicate").length,
    rows,
    dryRun: true,
  };
}
