import "server-only";
import { isStockmanReadingSufficient } from "@/lib/orders/stockman-checkout-policy";

import { prisma } from "@/lib/db/prisma";
import type { CartItem } from "@/lib/cart/types";
import { getStockmanProducts } from "@/lib/suppliers/stockman/client";
import { acquireStockmanDistributedSlot } from "@/lib/suppliers/stockman/distributed-guard";
import {
  isBlockedStockmanReference,
  stockmanSource,
} from "@/lib/suppliers/stockman/order-policy";

type CheckoutLine = Pick<
  CartItem,
  "kind" | "supplier" | "code" | "quantity"
>;

function unavailable(): never {
  throw new Error(
    "La disponibilite de certains articles ne peut pas etre confirmee. Merci de modifier votre panier ou de demander un devis.",
  );
}

function sourceUrl(value: unknown): string | null {
  const url = stockmanSource(value).sourceUrl;
  return typeof url === "string" && url.trim()
    ? url.trim()
    : null;
}

// OYSTE_STOCKMAN_CHECKOUT_GUARD_V1
// Lecture fournisseur uniquement. Aucune ecriture dans Neon.
export async function assertStockmanCheckoutAvailability(
  items: CheckoutLine[],
): Promise<void> {
  const quantities = new Map<string, number>();

  for (const item of items) {
    if (
      item.kind !== "catalogue" ||
      item.supplier?.trim().toUpperCase() !== "STOCKMAN"
    ) {
      continue;
    }

    const reference = item.code?.trim().toUpperCase() || "";

    if (
      !/^[A-Z0-9][A-Z0-9./_-]{1,30}$/.test(reference) ||
      isBlockedStockmanReference(reference) ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1
    ) {
      unavailable();
    }

    quantities.set(
      reference,
      (quantities.get(reference) || 0) + item.quantity,
    );
  }

  if (!quantities.size) return;

  // Protection contre les paniers anormalement volumineux.
  if (quantities.size > 10) unavailable();

  const supplier = {
    OR: [
      { name: { equals: "STOCKMAN", mode: "insensitive" as const } },
      { slug: { equals: "stockman", mode: "insensitive" as const } },
    ],
  };

  const targets: Array<{
    reference: string;
    productUrl: string;
  }> = [];

  for (const [reference, quantity] of quantities) {
    if (quantity > 99) unavailable();

    const identity = {
      OR: [
        { code: { equals: reference, mode: "insensitive" as const } },
        { supplierCode: { equals: reference, mode: "insensitive" as const } },
      ],
    };

    const variants = await prisma.productVariant.findMany({
      where: {
        ...identity,
        product: {
          publicationStatus: "PUBLISHED",
          supplier,
        },
      },
      select: {
        sourceData: true,
        product: {
          select: { sourceData: true },
        },
      },
      take: 2,
    });

    if (variants.length > 1) unavailable();

    let url: string | null = null;

    if (variants.length === 1) {
      url =
        sourceUrl(variants[0].sourceData) ??
        sourceUrl(variants[0].product.sourceData);
    } else {
      const products = await prisma.product.findMany({
        where: {
          ...identity,
          publicationStatus: "PUBLISHED",
          supplier,
        },
        select: { sourceData: true },
        take: 2,
      });

      if (products.length !== 1) unavailable();
      url = sourceUrl(products[0].sourceData);
    }

    if (!url) unavailable();

    targets.push({ reference, productUrl: url });
  }

  // Un seul navigateur fournisseur pour les references du panier.
  let readings: Awaited<ReturnType<typeof getStockmanProducts>>;

  // OYSTE_STOCKMAN_CHECKOUT_REDIS_V1
  // Le paiement partage le meme verrou que les controles panier.
  let release: (() => Promise<void>) | null = null;

  try {
    if (process.env.NODE_ENV === "production") {
      release = await acquireStockmanDistributedSlot();

      if (!release) {
        unavailable();
      }
    }

    readings = await getStockmanProducts(targets);
  } catch {
    unavailable();
  } finally {
    if (release) {
      await release().catch(() => undefined);
    }
  }

  if (readings.length !== targets.length) unavailable();

  for (let index = 0; index < targets.length; index++) {
    const reference = targets[index].reference;
    const required = quantities.get(reference) || 0;
    const product = readings[index].product;

    if (!isStockmanReadingSufficient(product, reference, required)) unavailable();
  }
}