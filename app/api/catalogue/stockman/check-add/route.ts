import { NextResponse } from "next/server";
import { z } from "zod";
import { getStockmanNeonPrices } from "@/lib/catalogue/stockman-neon-prices";
import { prisma } from "@/lib/db/prisma";
import { getStockmanProduct } from "@/lib/suppliers/stockman/client";
import { acquireStockmanDistributedSlot } from "@/lib/suppliers/stockman/distributed-guard";
import {
  isBlockedStockmanReference,
  hasStockmanPriceHold,
  isHistoricalStockmanShipping,
  stockmanShippingMode,
  stockmanSource,
} from "@/lib/suppliers/stockman/order-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  code: z.string().trim().min(2).max(31),
  quantity: z.number().int().min(1).max(99),
});

const noCache = { "Cache-Control": "no-store, max-age=0" };

function reply(
  payload: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(payload, {
    status,
    headers: noCache,
  });
}

function sourceUrl(value: unknown): string | null {
  const url = stockmanSource(value).sourceUrl;
  return typeof url === "string" && url.trim()
    ? url.trim()
    : null;
}

async function checkStockmanAdd(request: Request) {
  const body = schema.safeParse(
    await request.json().catch(() => null),
  );

  if (!body.success) {
    return reply({ allowed: false, reason: "invalid_request" }, 400);
  }

  const reference = body.data.code.toUpperCase();
  const quantity = body.data.quantity;

  if (isBlockedStockmanReference(reference) || hasStockmanPriceHold(reference)) {
    return reply({ allowed: false, reason: "blocked" }, 409);
  }

  const identity = {
    OR: [
      { code: { equals: reference, mode: "insensitive" as const } },
      { supplierCode: { equals: reference, mode: "insensitive" as const } },
    ],
  };

  const supplier = {
    OR: [
      { name: { equals: "STOCKMAN", mode: "insensitive" as const } },
      { slug: { equals: "stockman", mode: "insensitive" as const } },
    ],
  };

  try {
    const variants = await prisma.productVariant.findMany({
      where: {
        ...identity,
        product: {
          publicationStatus: "PUBLISHED",
          supplier,
        },
      },
      select: {
        code: true,
        supplierCode: true,
        sourceData: true,
        shippingMode: true,
        createdAt: true,
        product: {
          select: {
            publicationStatus: true, publishedAt: true, createdAt: true,
            sourceData: true,
            shippingMode: true,
          },
        },
      },
      take: 2,
    });

    if (variants.length > 1) {
      return reply({ allowed: false, reason: "ambiguous_reference" }, 409);
    }

    let url: string | null = null;
    let supplierReference = reference;
    let catalogueCode = reference;
    let shippingMode: ReturnType<typeof stockmanShippingMode> = "QUOTE";

    if (variants.length === 1) {
      const variant = variants[0];

      url =
        sourceUrl(variant.sourceData) ??
        sourceUrl(variant.product.sourceData);

      supplierReference = variant.supplierCode?.trim().toUpperCase() || reference;
      catalogueCode = variant.code.trim().toUpperCase();
      shippingMode = stockmanShippingMode(variant.sourceData, variant.shippingMode ?? variant.product.shippingMode, isHistoricalStockmanShipping(variant.product, variant.createdAt));
    } else {
      const products = await prisma.product.findMany({
        where: {
          ...identity,
          publicationStatus: "PUBLISHED",
          supplier,
        },
        select: {
          sourceData: true,
          publicationStatus: true, publishedAt: true, createdAt: true,
          shippingMode: true,
          code: true,
          supplierCode: true,
        },
        take: 2,
      });

      if (products.length !== 1) {
        return reply({ allowed: false, reason: "product_not_found" }, 404);
      }

      url = sourceUrl(products[0].sourceData);
      supplierReference = products[0].supplierCode?.trim().toUpperCase() || reference;
      catalogueCode = products[0].code.trim().toUpperCase();
      shippingMode = stockmanShippingMode(products[0].sourceData, products[0].shippingMode, isHistoricalStockmanShipping(products[0]));
    }

    if (isBlockedStockmanReference(supplierReference) || hasStockmanPriceHold(supplierReference, catalogueCode)) {
      return reply({ allowed: false, reason: "blocked" }, 409);
    }

    if (!url) {
      return reply({ allowed: false, reason: "source_url_missing" }, 409);
    }

    if (shippingMode === "QUOTE") {
      return reply({ allowed: false, reason: "freight_not_validated" }, 409);
    }

    const prices = await getStockmanNeonPrices([supplierReference, catalogueCode]);
    if (!prices.has(supplierReference) && !prices.has(catalogueCode)) {
      return reply({
        allowed: false,
        reason: "sale_price_missing",
      }, 409);
    }

    const live = await getStockmanProduct(supplierReference, url);

    if (
      live.reference.trim().toUpperCase() !== supplierReference ||
      live.stockOnRequest ||
      !Number.isSafeInteger(live.stock) ||
      live.stock < 0
    ) {
      return reply({
        allowed: false,
        reason: "unconfirmed_stock",
      }, 409);
    }

    if (live.stock < quantity) {
      return reply({
        allowed: false,
        reason: "insufficient_stock",
        stockAvailable: live.stock,
        checkedAt: live.readAt,
      }, 409);
    }


    return reply({
      allowed: true,
      reference,
      stockAvailable: live.stock,
      checkedAt: live.readAt,
    });
  } catch {
    // Ne jamais exposer les diagnostics de session revendeur au client.
    return reply({
      allowed: false,
      reason: "supplier_unavailable",
    }, 503);
  }
}
// OYSTE_STOCKMAN_API_GUARD_V1
// Premiere protection en memoire, par instance Node.js.
// A completer par une limitation distribuee avant production.
const STOCKMAN_WINDOW_MS = 60_000;
const STOCKMAN_MAX_PER_WINDOW = 24;
const STOCKMAN_MAX_CONCURRENT = 2;

let stockmanWindowStart = Date.now();
let stockmanRequestsInWindow = 0;
let stockmanActiveRequests = 0;

export async function POST(request: Request) {
  const now = Date.now();

  if (now - stockmanWindowStart >= STOCKMAN_WINDOW_MS) {
    stockmanWindowStart = now;
    stockmanRequestsInWindow = 0;
  }

  if (
    stockmanRequestsInWindow >= STOCKMAN_MAX_PER_WINDOW ||
    stockmanActiveRequests >= STOCKMAN_MAX_CONCURRENT
  ) {
    return reply(
      { allowed: false, reason: "temporarily_busy" },
      429,
    );
  }

  stockmanRequestsInWindow += 1;
  stockmanActiveRequests += 1;

  // OYSTE_STOCKMAN_DISTRIBUTED_GUARD_V1
  let release: (() => Promise<void>) | null = null;

  try {
    if (process.env.NODE_ENV === "production") {
      release = await acquireStockmanDistributedSlot();

      if (!release) {
        return reply(
          { allowed: false, reason: "temporarily_busy" },
          429,
        );
      }
    }

    return await checkStockmanAdd(request);
  } catch {
    return reply(
      { allowed: false, reason: "temporarily_busy" },
      503,
    );
  } finally {
    if (release) {
      await release().catch(() => undefined);
    }

    stockmanActiveRequests -= 1;
  }
}
