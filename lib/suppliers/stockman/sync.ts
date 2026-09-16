import { prisma } from "@/lib/db/prisma";
import { resolveStockmanCategory } from "@/lib/suppliers/stockman/category";
import { buildStockmanSeo } from "@/lib/suppliers/stockman/seo";
import type { Prisma } from "@/generated/prisma/client";
import type {
  StockmanBulkTarget,
  StockmanProduct,
  StockmanSyncField,
  StockmanSyncResult,
} from "@/lib/suppliers/stockman/types";

type SourceData = Record<string, unknown>;
type ExpectedTarget = { targetType: "product" | "variant"; targetId: string; productId: string };

function decimalToNumber(value: { toString(): string } | null) {
  return value === null ? null : Number(value.toString());
}

function sourceObject(value: Prisma.JsonValue | null): SourceData {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value } as SourceData : {};
}

function stockmanObject(value: Prisma.JsonValue | null): SourceData {
  const source = sourceObject(value);
  const stockman = source.stockman;
  return stockman && typeof stockman === "object" && !Array.isArray(stockman) ? { ...(stockman as SourceData) } : {};
}

function sourceNumber(value: Prisma.JsonValue | null, key: string) {
  const candidate = stockmanObject(value)[key];
  return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : null;
}

function sourceString(value: Prisma.JsonValue | null, key: string) {
  const candidate = stockmanObject(value)[key];
  return typeof candidate === "string" && candidate.trim() ? candidate : null;
}

function syncedSourceData(
  value: Prisma.JsonValue | null,
  product: StockmanProduct,
  syncedAt: Date,
  fields: StockmanSyncField[],
  includeFeatures = false,
): Prisma.InputJsonValue {
  const previous = stockmanObject(value);
  return {
    ...sourceObject(value),
    stockman: {
      ...previous,
      reference: product.reference,
      designation: product.designation,
      sourceUrl: product.sourceUrl,
      syncedAt: syncedAt.toISOString(),
      readAt: product.readAt,
      ...(fields.includes("price") ? { purchasePriceExVat: product.purchasePriceExVat } : {}),
      ...(fields.includes("stock") ? { stock: product.stock } : {}),
      ...(fields.includes("weight") ? { weightKg: stockmanUsableWeight(product.weightKg) } : {}),
      ...(includeFeatures ? { features: product.features ?? [] } : {}),
    },
  };
}

function sourceFeatures(value: Prisma.JsonValue | null) {
  const candidate = stockmanObject(value).features;
  if (!Array.isArray(candidate)) return [] as Array<{ label: string; value: string }>;
  return candidate
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const row = item as Record<string, unknown>;
      const label = typeof row.label === "string" ? row.label.trim() : "";
      const featureValue = typeof row.value === "string" ? row.value.trim() : "";
      return label && featureValue ? { label, value: featureValue } : null;
    })
    .filter((item): item is { label: string; value: string } => Boolean(item));
}

function featureKey(label: string) {
  return label.trim().toLocaleLowerCase("fr").replace(/\s+/g, " ");
}

async function syncSupplierFeatures(
  tx: Prisma.TransactionClient,
  target: { targetType: "product"; id: string } | { targetType: "variant"; id: string },
  currentFeatures: Array<{ id: string; label: string; value: string }>,
  previousSupplierFeatures: Array<{ label: string; value: string }>,
  incomingFeatures: Array<{ label: string; value: string }>,
) {
  if (!incomingFeatures.length) return;

  // Une caractéristique déjà importée par Stockman reste gérée par Stockman tant
  // qu'elle n'a pas été modifiée manuellement dans OYSTE. Si l'utilisateur change
  // sa valeur, elle est considérée comme manuelle et n'est plus écrasée.
  const previousPairs = new Set(
    previousSupplierFeatures.map((feature) => `${featureKey(feature.label)}\u0000${feature.value.trim()}`),
  );
  const supplierManagedIds = currentFeatures
    .filter((feature) => previousPairs.has(`${featureKey(feature.label)}\u0000${feature.value.trim()}`))
    .map((feature) => feature.id);
  const protectedLabels = new Set(
    currentFeatures
      .filter((feature) => !supplierManagedIds.includes(feature.id))
      .map((feature) => featureKey(feature.label)),
  );

  if (target.targetType === "product") {
    if (supplierManagedIds.length) await tx.productFeature.deleteMany({ where: { id: { in: supplierManagedIds } } });
    const rows = incomingFeatures
      .filter((feature) => !protectedLabels.has(featureKey(feature.label)))
      .map((feature, index) => ({ productId: target.id, label: feature.label, value: feature.value, sortOrder: index }));
    if (rows.length) await tx.productFeature.createMany({ data: rows });
    return;
  }

  if (supplierManagedIds.length) await tx.productVariantFeature.deleteMany({ where: { id: { in: supplierManagedIds } } });
  const rows = incomingFeatures
    .filter((feature) => !protectedLabels.has(featureKey(feature.label)))
    .map((feature, index) => ({ variantId: target.id, label: feature.label, value: feature.value, sortOrder: index }));
  if (rows.length) await tx.productVariantFeature.createMany({ data: rows });
}

function stockmanUsableWeight(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function changedFieldsFor(
  previous: { stock: number; weightKg: number | null; purchasePriceExVat: number | null },
  product: StockmanProduct,
  fields: StockmanSyncField[],
) {
  const changed: StockmanSyncField[] = [];
  if (fields.includes("stock") && previous.stock !== product.stock) changed.push("stock");
  if (fields.includes("weight") && previous.weightKg !== stockmanUsableWeight(product.weightKg)) changed.push("weight");
  if (fields.includes("price") && previous.purchasePriceExVat !== product.purchasePriceExVat) changed.push("price");
  return changed;
}

export async function listStockmanBulkTargets(): Promise<StockmanBulkTarget[]> {
  const [variants, products] = await Promise.all([
    prisma.productVariant.findMany({
      select: { id: true, productId: true, name: true, supplierCode: true, sourceData: true },
      orderBy: [{ productId: "asc" }, { name: "asc" }],
    }),
    prisma.product.findMany({
      select: { id: true, name: true, supplierCode: true, sourceData: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const targets: StockmanBulkTarget[] = [];
  const variantKeys = new Set<string>();

  for (const variant of variants) {
    const reference = sourceString(variant.sourceData, "reference") ?? variant.supplierCode?.trim().toUpperCase() ?? null;
    const sourceUrl = sourceString(variant.sourceData, "sourceUrl");
    if (!reference || !sourceUrl) continue;
    variantKeys.add(`${variant.productId}:${reference}`);
    targets.push({
      targetType: "variant",
      targetId: variant.id,
      productId: variant.productId,
      name: variant.name,
      reference,
      sourceUrl,
      syncedAt: sourceString(variant.sourceData, "syncedAt"),
    });
  }

  for (const product of products) {
    const reference = sourceString(product.sourceData, "reference") ?? product.supplierCode?.trim().toUpperCase() ?? null;
    const sourceUrl = sourceString(product.sourceData, "sourceUrl");
    if (!reference || !sourceUrl || variantKeys.has(`${product.id}:${reference}`)) continue;
    targets.push({
      targetType: "product",
      targetId: product.id,
      productId: product.id,
      name: product.name,
      reference,
      sourceUrl,
      syncedAt: sourceString(product.sourceData, "syncedAt"),
    });
  }

  return targets.sort((a, b) => a.reference.localeCompare(b.reference, "fr"));
}

function looksLikeAutoImportedVariantListing(value: string | null | undefined) {
  const text = value?.trim();
  if (!text) return false;
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 3) return false;
  const variantLike = lines.filter((line) =>
    /\b(?:lev[eé]e|hauteur|m[aâ]t)\b.*\b\d{3,5}\s*mm\b/i.test(line)
    && /\bbatterie\b.*\b\d{2,4}\s*ah\b/i.test(line),
  ).length;
  return variantLike >= 3 && variantLike / lines.length >= 0.6;
}

function normalizeStockmanEditorial(value: string | null | undefined) {
  return (value ?? "")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*|__/g, "")
    .replace(/^\s*[•*-]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function looksLikePreviousStockmanEditorial(
  currentValue: string | null | undefined,
  incomingValue: string | null | undefined,
) {
  const current = normalizeStockmanEditorial(currentValue);
  const incoming = normalizeStockmanEditorial(incomingValue);
  if (current.length < 220 || incoming.length < 220) return false;

  // V2.9.9.2 : la nouvelle version structurée peut ajouter des titres <b>/<strong>
  // avant et entre les paragraphes. Une comparaison de préfixe stricte ne suffit
  // donc plus. On considère l'ancien texte comme import Stockman si de larges
  // fragments de son contenu existent encore dans le nouveau contenu structuré.
  const probes = [
    current.slice(0, Math.min(220, current.length)),
    current.slice(
      Math.max(0, Math.floor(current.length * 0.35)),
      Math.min(current.length, Math.floor(current.length * 0.35) + 220),
    ),
    current.slice(
      Math.max(0, Math.floor(current.length * 0.7)),
      Math.min(current.length, Math.floor(current.length * 0.7) + 220),
    ),
  ]
    .map((probe) => probe.trim())
    .filter((probe) => probe.length >= 120);

  const matchedProbes = probes.filter((probe) => incoming.includes(probe)).length;
  if (matchedProbes >= 2) return true;
  if (probes.length === 1 && matchedProbes === 1) return true;

  // Dernier filet de sécurité : comparaison par mots significatifs. Cela permet
  // la migration si les titres ont été ajoutés, sans écraser un texte manuel qui
  // divergerait réellement du contenu fournisseur.
  const significantWords = (value: string) =>
    value
      .split(/[^a-z0-9à-ÿ]+/i)
      .map((word) => word.trim())
      .filter((word) => word.length >= 5);

  const currentWords = significantWords(current);
  const incomingWords = new Set(significantWords(incoming));
  if (currentWords.length < 40) return false;

  const uniqueCurrentWords = Array.from(new Set(currentWords));
  const commonWords = uniqueCurrentWords.filter((word) => incomingWords.has(word)).length;
  return commonWords / uniqueCurrentWords.length >= 0.88;
}

export async function syncStockmanProduct(
  product: StockmanProduct,
  expected?: ExpectedTarget,
  selectedFields: StockmanSyncField[] = ["price", "stock", "weight"],
  applyEnrichment = false,
): Promise<StockmanSyncResult> {
  const fields = Array.from(new Set(selectedFields));
  if (!fields.length) throw new Error("Sélectionnez au moins une donnée à synchroniser.");

  const reference = product.reference.trim().toUpperCase();
  const syncedAt = new Date();
  const variant = expected?.targetType === "variant"
    ? await prisma.productVariant.findUnique({
      where: { id: expected.targetId },
      include: {
        features: { orderBy: { sortOrder: "asc" } },
        product: { select: { id: true, supplierCode: true, sourceData: true, categoryId: true } },
      },
    })
    : await prisma.productVariant.findFirst({
      where: { supplierCode: { equals: reference, mode: "insensitive" } },
      include: {
        features: { orderBy: { sortOrder: "asc" } },
        product: { select: { id: true, supplierCode: true, sourceData: true, categoryId: true } },
      },
    });

  if (variant) {
    if (expected && (expected.targetType !== "variant" || expected.targetId !== variant.id || expected.productId !== variant.productId)) {
      throw new Error("La référence Stockman correspond à une autre fiche OYSTE.");
    }
    const linkedReference = sourceString(variant.sourceData, "reference") ?? variant.supplierCode?.trim().toUpperCase() ?? null;
    if (linkedReference && linkedReference !== reference) {
      throw new Error(`La cible OYSTE est liée à ${linkedReference}, pas à ${reference}.`);
    }
    const previous = {
      stock: variant.stock,
      weightKg: decimalToNumber(variant.weightKg),
      purchasePriceExVat: sourceNumber(variant.sourceData, "purchasePriceExVat"),
    };
    const changedFields = changedFieldsFor(previous, product, fields);
    const metadataChanged = sourceString(variant.sourceData, "sourceUrl") !== product.sourceUrl;
    const categoryResolution = await resolveStockmanCategory({
      sourceUrl: product.sourceUrl,
      designation: product.designation,
    });
    const incomingFeatures = applyEnrichment ? (product.features ?? []) : [];

    if (changedFields.length || metadataChanged || Boolean(categoryResolution) || incomingFeatures.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.productVariant.update({
          where: { id: variant.id },
          data: {
            ...(fields.includes("stock") ? { stock: product.stock } : {}),
            ...(fields.includes("weight") ? { weightKg: stockmanUsableWeight(product.weightKg) } : {}),
            sourceData: syncedSourceData(variant.sourceData, product, syncedAt, fields, applyEnrichment),
          },
        });
        if (fields.includes("stock")) {
          const variants = await tx.productVariant.findMany({ where: { productId: variant.productId }, select: { stock: true } });
          await tx.product.update({
            where: { id: variant.productId },
            data: {
              stock: variants.reduce((total: number, item: { stock: number }) => total + item.stock, 0),
              ...(categoryResolution ? { categoryId: categoryResolution.id } : {}),
            },
          });
        }
        if (!fields.includes("stock") && categoryResolution) {
          await tx.product.update({
            where: { id: variant.productId },
            data: { categoryId: categoryResolution.id },
          });
        }

        if (incomingFeatures.length) {
          await syncSupplierFeatures(
            tx,
            { targetType: "variant", id: variant.id },
            variant.features,
            sourceFeatures(variant.sourceData),
            incomingFeatures,
          );
        }

        const isDefaultVariant = variant.product.supplierCode?.toUpperCase() === reference;
        if (isDefaultVariant && (fields.includes("weight") || fields.includes("price"))) {
          await tx.product.update({
            where: { id: variant.productId },
            data: {
              ...(fields.includes("weight") ? { weightKg: stockmanUsableWeight(product.weightKg) } : {}),
              sourceData: syncedSourceData(variant.product.sourceData, product, syncedAt, fields),
            },
          });
        }
      });
    }

    return {
      targetType: "variant",
      targetId: variant.id,
      productId: variant.productId,
      name: variant.name,
      reference,
      previous,
      current: { stock: product.stock, weightKg: product.weightKg, purchasePriceExVat: product.purchasePriceExVat },
      syncedAt: syncedAt.toISOString(),
      status: changedFields.length ? "updated" : "unchanged",
      changedFields,
    };
  }

  const existing = expected?.targetType === "product"
    ? await prisma.product.findUnique({ where: { id: expected.targetId } })
    : await prisma.product.findFirst({ where: { supplierCode: { equals: reference, mode: "insensitive" } } });
  if (!existing) throw new Error(`Aucun produit OYSTE ne possède la référence fournisseur ${reference}.`);
  if (expected && (expected.targetType !== "product" || expected.targetId !== existing.id || expected.productId !== existing.id)) {
    throw new Error("La référence Stockman correspond à une autre fiche OYSTE.");
  }
  const linkedReference = sourceString(existing.sourceData, "reference") ?? existing.supplierCode?.trim().toUpperCase() ?? null;
  if (linkedReference && linkedReference !== reference) {
    throw new Error(`La cible OYSTE est liée à ${linkedReference}, pas à ${reference}.`);
  }

  const previous = {
    stock: existing.stock,
    weightKg: decimalToNumber(existing.weightKg),
    purchasePriceExVat: sourceNumber(existing.sourceData, "purchasePriceExVat"),
  };
  const changedFields = changedFieldsFor(previous, product, fields);
  const metadataChanged = sourceString(existing.sourceData, "sourceUrl") !== product.sourceUrl;
  const categoryResolution = await resolveStockmanCategory({
    sourceUrl: product.sourceUrl,
    designation: product.designation,
  });

  const seo = applyEnrichment ? buildStockmanSeo(product) : null;

  const enrichment = applyEnrichment ? {
    shortDescription: product.shortDescription?.trim() || null,
    detailedDescription: product.detailedDescription?.trim() || null,
    images: product.images ?? [],
    documents: product.documents ?? [],
    features: product.features ?? [],
  } : null;

  const enrichmentRequested = Boolean(
    enrichment && (
      enrichment.shortDescription
      || enrichment.detailedDescription
      || enrichment.images.length
      || enrichment.documents.length
      || enrichment.features.length
    ),
  );

  if (changedFields.length || metadataChanged || enrichmentRequested || Boolean(categoryResolution)) {
    await prisma.$transaction(async (tx) => {
      const current = await tx.product.findUnique({
        where: { id: existing.id },
        select: {
          description: true,
          detailedDescription: true,
          seoTitle: true,
          seoDescription: true,
          features: { select: { id: true, label: true, value: true }, orderBy: { sortOrder: "asc" } },
        },
      });
      if (!current) throw new Error("Produit OYSTE introuvable pendant la synchronisation.");

      await tx.product.update({
        where: { id: existing.id },
        data: {
          ...(fields.includes("stock") ? { stock: product.stock } : {}),
          ...(fields.includes("weight") ? { weightKg: stockmanUsableWeight(product.weightKg) } : {}),
          ...(categoryResolution ? { categoryId: categoryResolution.id } : {}),
          ...(enrichment?.shortDescription && !current.description?.trim()
            ? { description: enrichment.shortDescription }
            : {}),
          ...(enrichment?.detailedDescription && (
            !current.detailedDescription?.trim()
            || looksLikeAutoImportedVariantListing(current.detailedDescription)
            || looksLikePreviousStockmanEditorial(current.detailedDescription, enrichment.detailedDescription)
          )
            ? { detailedDescription: enrichment.detailedDescription }
            : {}),
          // SEO Stockman : uniquement lors de l'enrichissement explicite. Les valeurs
          // générées sont propres à la référence/variante synchronisée. On remplace aussi
          // l'ancien SEO automatique OYSTE afin que les fiches déjà importées migrent.
          ...(seo && (
            !current.seoTitle?.trim()
            || current.seoTitle === `${existing.name} | OYSTE`
            || current.seoTitle.endsWith(" | OYSTE")
          ) ? { seoTitle: seo.seoTitle } : {}),
          ...(seo && (
            !current.seoDescription?.trim()
            || current.seoDescription === existing.description
            || current.seoDescription === enrichment?.shortDescription
          ) ? { seoDescription: seo.seoDescription } : {}),
          sourceData: syncedSourceData(existing.sourceData, product, syncedAt, fields, applyEnrichment),
        },
      });

      // Les médias Stockman sont ajoutés sans supprimer les contenus OYSTE.
      // Lorsqu'un vrai visuel fournisseur existe, il devient la source de vérité
      // pour l'image principale : on retire d'abord l'ancien flag primaire, puis
      // on marque explicitement la première image Stockman.
      if ((enrichment?.images ?? []).length) {
        await tx.productMedia.updateMany({
          where: { productId: existing.id, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      for (const [index, image] of (enrichment?.images ?? []).entries()) {
        await tx.productMedia.upsert({
          where: { productId_url: { productId: existing.id, url: image.url } },
          update: {
            sourceUrl: image.url,
            altText: image.altText || existing.name,
            isPrimary: index === 0,
            sortOrder: index,
          },
          create: {
            productId: existing.id,
            type: "IMAGE",
            url: image.url,
            sourceUrl: image.url,
            altText: image.altText || existing.name,
            isPrimary: index === 0,
            sortOrder: index,
          },
        });
      }

      for (const [index, document] of (enrichment?.documents ?? []).entries()) {
        await tx.productDocument.upsert({
          where: { productId_url: { productId: existing.id, url: document.url } },
          update: {
            name: document.name,
            type: document.type,
            sourceUrl: document.url,
          },
          create: {
            productId: existing.id,
            name: document.name,
            type: document.type,
            url: document.url,
            sourceUrl: document.url,
            isPublic: true,
            sortOrder: index,
          },
        });
      }

      if (enrichment?.features.length) {
        await syncSupplierFeatures(
          tx,
          { targetType: "product", id: existing.id },
          current.features,
          sourceFeatures(existing.sourceData),
          enrichment.features,
        );
      }
    });
  }

  return {
    targetType: "product",
    targetId: existing.id,
    productId: existing.id,
    name: existing.name,
    reference,
    previous,
    current: { stock: product.stock, weightKg: product.weightKg, purchasePriceExVat: product.purchasePriceExVat },
    syncedAt: syncedAt.toISOString(),
    status: changedFields.length ? "updated" : "unchanged",
    changedFields,
  };
}
