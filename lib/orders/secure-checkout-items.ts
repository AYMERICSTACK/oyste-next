import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { CartItem } from "@/lib/cart/types";
import { calculateKitoDynamicWeightKg } from "@/lib/shipping/kito-chain-weight";
import { calculateKitoDynamicPriceHT } from "@/lib/pricing/kito-chain-price";

export type CheckoutItemInput = Omit<CartItem, "addedAt"> & { addedAt?: string };

function positivePrice(value: unknown) {
  const price = Number(value);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Un produit de votre panier est disponible uniquement sur devis.");
  }
  return price;
}


function catalogueOrderDisplayName(productName: string, code: string) {
  if (/^TSG/i.test(code) && /chariot manuel par cha[iî]ne/i.test(productName)) {
    return "Chariot manuel par chaîne";
  }
  return productName;
}

function extractCatalogueCode(item: CheckoutItemInput) {
  const fromId = item.id.startsWith("catalogue:") ? item.id.slice("catalogue:".length).trim() : "";
  return (item.code || fromId).trim();
}

export async function resolveSecureCheckoutItems(items: CheckoutItemInput[]): Promise<CheckoutItemInput[]> {
  const result: CheckoutItemInput[] = [];

  for (const item of items) {
    if (item.kind !== "catalogue") {
      // Les configurateurs possèdent leurs propres règles métier. Ils restent
      // résolus par leurs paramètres techniques, mais jamais par un faux mode
      // de transport catalogue.
      result.push(item);
      continue;
    }

    const code = extractCatalogueCode(item);
    if (!code) throw new Error("Une référence catalogue du panier est invalide.");

    const variant = await prisma.productVariant.findFirst({
      where: { code: { equals: code, mode: "insensitive" } },
      include: { product: { include: { supplier: true } } },
    });

    if (variant) {
      const product = variant.product;
      if (product.publicationStatus !== "PUBLISHED") {
        throw new Error(`La référence ${code} n’est plus disponible à la commande.`);
      }
      result.push({
        ...item,
        id: `catalogue:${variant.code}`,
        name: catalogueOrderDisplayName(product.name, variant.code),
        code: variant.code,
        supplier: product.supplier?.name || undefined,
        family: product.configuratorFamily || item.family,
        weightKg: calculateKitoDynamicWeightKg({
          supplier: product.supplier?.name || undefined,
          code: variant.code,
          baseWeightKg: variant.weightKg != null ? Number(variant.weightKg) : product.weightKg != null ? Number(product.weightKg) : undefined,
          technicalLines: item.technicalLines,
        }),
        packageLengthCm: variant.packageLengthCm != null ? Number(variant.packageLengthCm) : product.packageLengthCm != null ? Number(product.packageLengthCm) : undefined,
        packageWidthCm: variant.packageWidthCm != null ? Number(variant.packageWidthCm) : product.packageWidthCm != null ? Number(product.packageWidthCm) : undefined,
        packageHeightCm: variant.packageHeightCm != null ? Number(variant.packageHeightCm) : product.packageHeightCm != null ? Number(product.packageHeightCm) : undefined,
        shippingMode: (variant.shippingMode || product.shippingMode) as CartItem["shippingMode"],
        pfiShipping: undefined,
        wallPotenceShipping: undefined,
        unitPriceHT: await calculateKitoDynamicPriceHT({
          supplier: product.supplier?.name || undefined,
          code: variant.code,
          basePriceHT: positivePrice(variant.priceHt),
          technicalLines: item.technicalLines,
        }),
      });
      continue;
    }

    const product = await prisma.product.findFirst({
      where: { code: { equals: code, mode: "insensitive" } },
      include: { supplier: true },
    });

    if (!product || product.publicationStatus !== "PUBLISHED") {
      throw new Error(`La référence ${code} n’est plus disponible à la commande.`);
    }

    result.push({
      ...item,
      id: `catalogue:${product.code}`,
      name: catalogueOrderDisplayName(product.name, product.code),
      code: product.code,
      supplier: product.supplier?.name || undefined,
      family: product.configuratorFamily || item.family,
      weightKg: calculateKitoDynamicWeightKg({
        supplier: product.supplier?.name || undefined,
        code: product.code,
        baseWeightKg: product.weightKg != null ? Number(product.weightKg) : undefined,
        technicalLines: item.technicalLines,
      }),
      packageLengthCm: product.packageLengthCm != null ? Number(product.packageLengthCm) : undefined,
      packageWidthCm: product.packageWidthCm != null ? Number(product.packageWidthCm) : undefined,
      packageHeightCm: product.packageHeightCm != null ? Number(product.packageHeightCm) : undefined,
      shippingMode: product.shippingMode as CartItem["shippingMode"],
      pfiShipping: undefined,
      wallPotenceShipping: undefined,
      unitPriceHT: await calculateKitoDynamicPriceHT({
        supplier: product.supplier?.name || undefined,
        code: product.code,
        basePriceHT: positivePrice(product.priceHt),
        technicalLines: item.technicalLines,
      }),
    });
  }

  return result;
}
