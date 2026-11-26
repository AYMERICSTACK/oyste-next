import { hasStockmanPriceHold, isHistoricalStockmanShipping, isBlockedStockmanReference, isStockmanSupplier, stockmanShippingMode } from "@/lib/suppliers/stockman/order-policy";

import "server-only";
import { getStockmanNeonPrices } from "@/lib/catalogue/stockman-neon-prices";

import { prisma } from "@/lib/db/prisma";
import { assertStockmanCheckoutAvailability } from "@/lib/orders/stockman-checkout-guard";
import type { CartItem } from "@/lib/cart/types";
import { calculateKitoDynamicWeightKg } from "@/lib/shipping/kito-chain-weight";
import { calculateKitoDynamicPriceHT } from "@/lib/pricing/kito-chain-price";

export type CheckoutItemInput = Omit<CartItem, "addedAt"> & {
  addedAt?: string;
};

function positivePrice(value: unknown) {
  const price = Number(value);

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(
      "Un produit de votre panier est disponible uniquement sur devis.",
    );
  }

  return price;
}

async function resolveStockmanNeonCheckoutPrice(
  supplier: string | null | undefined,
  supplierCode: string | null | undefined,
  code: string,
  originalPrice: unknown,
): Promise<number> {
  if (supplier?.trim().toUpperCase() !== "STOCKMAN") {
    return positivePrice(originalPrice);
  }

  const references = [...new Set(
    [supplierCode, code]
      .filter((value): value is string => Boolean(value?.trim()))
      .map(value => value.trim().toUpperCase())
  )];

  const prices = await getStockmanNeonPrices(references);

  for (const reference of references) {
    const price = prices.get(reference);
    if (price !== undefined) {
      return positivePrice(price);
    }
  }

  throw new Error("Tarif STOCKMAN indisponible dans Neon : nous consulter.");
}
function catalogueOrderDisplayName(productName: string, code: string) {
  if (/^TSG/i.test(code) && /chariot manuel par cha[iî]ne/i.test(productName)) {
    return "Chariot manuel par chaîne";
  }

  return productName;
}

function extractCatalogueCode(item: CheckoutItemInput) {
  const fromId = item.id.startsWith("catalogue:")
    ? item.id.slice("catalogue:".length).trim()
    : "";

  return (item.code || fromId).trim();
}

/**
 * Refuse une variante explicitement masquée dans la présentation BO.
 * Une variante non configurée reste autorisée.
 */
async function assertVariantAvailable(
  productId: string,
  variantId: string,
  code: string,
) {
  const presentation = await prisma.productPresentationOverride.findUnique({
    where: { productId },
    select: { value: true },
  });

  const value = presentation?.value;

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return;
  }

  const entries = (value as Record<string, unknown>).variantPresentation;

  if (!Array.isArray(entries)) {
    return;
  }

  const hidden = entries.some((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return false;
    }

    const setting = entry as Record<string, unknown>;

    return setting.id === variantId && setting.enabled === false;
  });

  if (hidden) {
    throw new Error(
      `La référence ${code} n’est plus disponible à la commande.`,
    );
  }
}

async function assertStockmanOrderable(
  supplier: string | undefined,
  reference: string,
  _sourceData: unknown,
  _shippingMode: unknown,
  catalogueCode: string,
) {
  // OYSTE_STOCKMAN_CHECKOUT_LIVE_V2
  // Conservation du blocage des references arretees.
  // Le prix OYSTE est controle via Neon.
  // Le stock est recontrole en direct avant validation.
  if (supplier?.trim().toUpperCase() !== "STOCKMAN") return;

  if (isBlockedStockmanReference(reference) || hasStockmanPriceHold(reference, catalogueCode)) {
    throw new Error("Cet article n'est plus disponible a la commande.");
  }
}
export async function resolveSecureCheckoutItems(
  items: CheckoutItemInput[],
): Promise<CheckoutItemInput[]> {
  const result: CheckoutItemInput[] = [];

  for (const item of items) {
    // Never allow a catalogue identity to bypass checks by changing its kind.
    if (item.kind !== "catalogue" && !item.id.startsWith("catalogue:") && !item.code) {
      // Les configurateurs possèdent leurs propres règles métier.
      // Ils restent résolus par leurs paramètres techniques.
      result.push(item);
      continue;
    }

    const code = extractCatalogueCode(item);

    if (!code) {
      throw new Error("Une référence catalogue du panier est invalide.");
    }

    const variants = await prisma.productVariant.findMany({
      take: 2,
      where: {
        code: {
          equals: code,
          mode: "insensitive",
        },
      },
      include: {
        product: {
          include: {
            supplier: true,
          },
        },
      },
    });

    if (variants.length > 1) throw new Error("Référence catalogue ambiguë : nous consulter.");
    const variant = variants[0];
    if (variant) {
      const product = variant.product;
      if (item.kind === "configured" && !item.id.startsWith("catalogue:") && product.supplier?.name?.trim().toUpperCase() !== "STOCKMAN") {
        result.push(item); continue;
      }
      await assertStockmanOrderable(product.supplier?.name, variant.supplierCode || variant.code, variant.sourceData, variant.shippingMode || product.shippingMode, variant.code);

      if (product.publicationStatus !== "PUBLISHED") {
        throw new Error(
          `La référence ${code} n’est plus disponible à la commande.`,
        );
      }

      // V246 : une variante masquée dans le BO
      // ne doit pas pouvoir être commandée directement.
      await assertVariantAvailable(product.id, variant.id, code);

      result.push({
        ...item,
        id: `catalogue:${variant.code}`,
        kind: "catalogue",
        name: catalogueOrderDisplayName(product.name, variant.code),
        code: variant.code,
        supplier: product.supplier?.name || undefined,
        family: product.configuratorFamily || item.family,
        weightKg: calculateKitoDynamicWeightKg({
          supplier: product.supplier?.name || undefined,
          code: variant.code,
          baseWeightKg:
            variant.weightKg != null
              ? Number(variant.weightKg)
              : product.weightKg != null
                ? Number(product.weightKg)
                : undefined,
          technicalLines: item.technicalLines,
        }),
        packageLengthCm:
          variant.packageLengthCm != null
            ? Number(variant.packageLengthCm)
            : product.packageLengthCm != null
              ? Number(product.packageLengthCm)
              : undefined,
        packageWidthCm:
          variant.packageWidthCm != null
            ? Number(variant.packageWidthCm)
            : product.packageWidthCm != null
              ? Number(product.packageWidthCm)
              : undefined,
        packageHeightCm:
          variant.packageHeightCm != null
            ? Number(variant.packageHeightCm)
            : product.packageHeightCm != null
              ? Number(product.packageHeightCm)
              : undefined,
        shippingMode: isStockmanSupplier(product.supplier?.name)
          ? stockmanShippingMode(variant.sourceData, variant.shippingMode || product.shippingMode, isHistoricalStockmanShipping(product, variant.createdAt))
          : variant.shippingMode || product.shippingMode,
        stockmanFreightConfirmed: isStockmanSupplier(product.supplier?.name)
          && stockmanShippingMode(variant.sourceData, variant.shippingMode || product.shippingMode, isHistoricalStockmanShipping(product, variant.createdAt)) === "INCLUDED",
        pfiShipping: undefined,
        wallPotenceShipping: undefined,
        unitPriceHT: await calculateKitoDynamicPriceHT({
          supplier: product.supplier?.name || undefined,
          code: variant.code,
          basePriceHT: await resolveStockmanNeonCheckoutPrice(product.supplier?.name, variant.supplierCode, variant.code, variant.priceHt),
          technicalLines: item.technicalLines,
        }),
      });

      continue;
    }

    const products = await prisma.product.findMany({
      take: 2,
      where: {
        code: {
          equals: code,
          mode: "insensitive",
        },
      },
      include: {
        supplier: true,
      },
    });

    if (products.length > 1) throw new Error("Référence catalogue ambiguë : nous consulter.");
    const product = products[0];
    if (!product && item.kind === "configured" && !item.id.startsWith("catalogue:") && !isBlockedStockmanReference(code)) {
      result.push(item);
      continue;
    }
    if (!product || product.publicationStatus !== "PUBLISHED") {
      throw new Error(
        `La référence ${code} n’est plus disponible à la commande.`,
      );
    }

    if (item.kind === "configured" && !item.id.startsWith("catalogue:") && product.supplier?.name?.trim().toUpperCase() !== "STOCKMAN") {
      result.push(item); continue;
    }
    await assertStockmanOrderable(product.supplier?.name, product.supplierCode || product.code, product.sourceData, product.shippingMode, product.code);
    const childCount = await prisma.productVariant.count({ where: { productId: product.id } });
    if (childCount > 0) throw new Error("Sélectionnez une référence variante disponible.");
    result.push({
      ...item,
      id: `catalogue:${product.code}`,
      kind: "catalogue",
      name: catalogueOrderDisplayName(product.name, product.code),
      code: product.code,
      supplier: product.supplier?.name || undefined,
      family: product.configuratorFamily || item.family,
      weightKg: calculateKitoDynamicWeightKg({
        supplier: product.supplier?.name || undefined,
        code: product.code,
        baseWeightKg:
          product.weightKg != null
            ? Number(product.weightKg)
            : undefined,
        technicalLines: item.technicalLines,
      }),
      packageLengthCm:
        product.packageLengthCm != null
          ? Number(product.packageLengthCm)
          : undefined,
      packageWidthCm:
        product.packageWidthCm != null
          ? Number(product.packageWidthCm)
          : undefined,
      packageHeightCm:
        product.packageHeightCm != null
          ? Number(product.packageHeightCm)
          : undefined,
      shippingMode: isStockmanSupplier(product.supplier?.name) ? stockmanShippingMode(product.sourceData, product.shippingMode, isHistoricalStockmanShipping(product)) : product.shippingMode,
      stockmanFreightConfirmed: isStockmanSupplier(product.supplier?.name) && stockmanShippingMode(product.sourceData, product.shippingMode, isHistoricalStockmanShipping(product)) === "INCLUDED",
      pfiShipping: undefined,
      wallPotenceShipping: undefined,
      unitPriceHT: await calculateKitoDynamicPriceHT({
        supplier: product.supplier?.name || undefined,
        code: product.code,
        basePriceHT: await resolveStockmanNeonCheckoutPrice(product.supplier?.name, product.supplierCode, product.code, product.priceHt),
        technicalLines: item.technicalLines,
      }),
    });
  }

  await assertStockmanCheckoutAvailability(result);

  return result;
}
