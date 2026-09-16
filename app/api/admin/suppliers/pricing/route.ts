import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db/prisma";
import { getStockmanProducts } from "@/lib/suppliers/stockman/client";
import {
  calculateSellingPriceHT,
  DEFAULT_SUPPLIER_PRICING_RULE,
  extractPurchasePriceFromSourceData,
  normalizePricingRule,
  supplierPricingSettingKey,
  type SupplierPricingRule,
} from "@/lib/pricing/supplier-pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ruleSchema = z.object({
  marginRate: z.number().min(0).max(95),
  purchaseAdjustmentRate: z.number().min(-95).max(500),
});

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save_rule"),
    supplierId: z.string().min(1),
    rule: ruleSchema,
  }),
  z.object({
    action: z.literal("preview"),
    supplierId: z.string().min(1),
    rule: ruleSchema,
  }),
  z.object({
    action: z.literal("apply"),
    supplierId: z.string().min(1),
    rule: ruleSchema,
  }),
  z.object({
    action: z.literal("apply_arbitrage"),
    supplierId: z.string().min(1),
    rule: ruleSchema,
    decisions: z.array(
      z.object({
        targetType: z.enum(["product", "variant"]),
        id: z.string().min(1),
        mode: z.enum(["current", "calculated", "manual"]),
        manualPriceHT: z.number().positive().nullable().optional(),
      }),
    ).min(1).max(5000),
  }),
  z.object({
    action: z.literal("backfill_stockman_purchase_prices"),
    supplierId: z.string().min(1),
    rule: ruleSchema,
    batchSize: z.number().int().min(1).max(30).optional(),
  }),
]);

async function authorize(write = false) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== "ACTIVE") {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }
  if (write && admin.role === "READ_ONLY") {
    return NextResponse.json(
      { message: "Votre rôle ne permet pas de modifier les tarifs." },
      { status: 403 },
    );
  }
  return null;
}

function money(value: number | null) {
  return value === null ? null : Math.round((value + Number.EPSILON) * 100) / 100;
}

async function getSupplierRule(supplierId: string): Promise<SupplierPricingRule> {
  const setting = await prisma.siteSetting.findUnique({
    where: { key: supplierPricingSettingKey(supplierId) },
    select: { value: true },
  });

  return setting
    ? normalizePricingRule(setting.value)
    : { ...DEFAULT_SUPPLIER_PRICING_RULE };
}

async function persistRule(supplierId: string, rule: SupplierPricingRule) {
  const value: Prisma.InputJsonValue = {
    marginRate: rule.marginRate,
    purchaseAdjustmentRate: rule.purchaseAdjustmentRate,
    updatedAt: new Date().toISOString(),
  };

  return prisma.siteSetting.upsert({
    where: { key: supplierPricingSettingKey(supplierId) },
    update: { value },
    create: {
      key: supplierPricingSettingKey(supplierId),
      value,
      description: "Règle de calcul des prix de vente par fournisseur.",
      isPublic: false,
    },
  });
}

async function buildSupplierPreview(supplierId: string, rule: SupplierPricingRule) {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: {
      id: true,
      name: true,
      products: {
        select: {
          id: true,
          code: true,
          name: true,
          priceHt: true,
          sourceData: true,
          variants: {
            select: {
              id: true,
              code: true,
              name: true,
              priceHt: true,
              sourceData: true,
            },
            orderBy: { code: "asc" },
          },
        },
        orderBy: { code: "asc" },
      },
    },
  });

  if (!supplier) return null;

  const lines: Array<{
    targetType: "product" | "variant";
    id: string;
    code: string;
    name: string;
    purchasePriceHT: number;
    currentSellingPriceHT: number;
    proposedSellingPriceHT: number;
    currentMarginRate: number | null;
  }> = [];

  let missingPurchasePrice = 0;
  const missingLines: Array<{
    targetType: "product" | "variant";
    id: string;
    code: string;
    name: string;
    reason: string;
    detail: string | null;
    classification: "parent_with_variants" | "supplier_consult" | "catalog_link_missing" | "stockman_inactive" | "source_url_missing" | "real_anomaly" | "generic_missing";
    blocking: boolean;
  }> = [];

  const isStockman = supplier.name.trim().toLocaleLowerCase("fr") === "stockman";
  const stockmanRefs = isStockman
    ? await prisma.stockmanCatalogReference.findMany({
        select: { targetType: true, targetId: true, isActive: true, sourceUrl: true, reference: true },
      })
    : [];
  const stockmanRefByTarget = new Map(
    stockmanRefs
      .filter((item) => item.targetId)
      .map((item) => [`${item.targetType}:${item.targetId}`, item]),
  );

  function missingReason(
    targetType: "product" | "variant",
    id: string,
    sourceData: Prisma.JsonValue | null,
    hasVariants = false,
  ) {
    // V2.11.1.2 — un produit parent STOCKMAN peut légitimement ne porter aucun
    // tarif : ce sont ses variantes commerciales qui sont tarifées. Ce cas est
    // valide et ne doit plus être présenté comme une anomalie de prix d'achat.
    if (isStockman && targetType === "product" && hasVariants) {
      return {
        reason: "Parent avec variantes",
        detail: "Le produit parent n’a pas de tarif propre : les prix sont portés par ses variantes STOCKMAN.",
        classification: "parent_with_variants" as const,
        blocking: false,
      };
    }
    if (isStockman && stockmanPurchasePriceUnavailable(sourceData)) {
      const root = sourceData && typeof sourceData === "object" && !Array.isArray(sourceData)
        ? sourceData as Record<string, unknown>
        : {};
      const stockman = root.stockman && typeof root.stockman === "object" && !Array.isArray(root.stockman)
        ? root.stockman as Record<string, unknown>
        : {};
      const detail = typeof stockman.purchasePriceUnavailableReason === "string"
        ? stockman.purchasePriceUnavailableReason
        : "STOCKMAN ne fournit pas de prix exploitable pour cette référence.";
      const consult = isCommerciallyUnavailableStockmanError(detail);
      return {
        reason: consult ? "Nous consulter — état commercial valide" : "Tarif fournisseur indisponible",
        detail,
        classification: consult ? "supplier_consult" as const : "real_anomaly" as const,
        blocking: !consult,
      };
    }
    if (!isStockman) return { reason: "Prix d’achat manquant", detail: null, classification: "generic_missing" as const, blocking: true };
    const ref = stockmanRefByTarget.get(`${targetType}:${id}`);
    if (!ref) return { reason: "Liaison catalogue STOCKMAN absente", detail: "Aucune référence du catalogue vivant n’est reliée à cette ligne.", classification: "catalog_link_missing" as const, blocking: true };
    if (!ref.isActive) return { reason: "Référence STOCKMAN inactive", detail: ref.reference, classification: "stockman_inactive" as const, blocking: true };
    if (!ref.sourceUrl?.trim()) return { reason: "URL source STOCKMAN absente", detail: ref.reference, classification: "source_url_missing" as const, blocking: true };
    return { reason: "Anomalie réelle à contrôler", detail: ref.reference, classification: "real_anomaly" as const, blocking: true };
  }

  for (const product of supplier.products) {
    const purchasePrice = extractPurchasePriceFromSourceData(product.sourceData);
    if (purchasePrice !== null) {
      const proposed = calculateSellingPriceHT(purchasePrice, rule);
      if (proposed !== null) {
        lines.push({
          targetType: "product",
          id: product.id,
          code: product.code,
          name: product.name,
          purchasePriceHT: purchasePrice,
          currentSellingPriceHT: Number(product.priceHt),
          proposedSellingPriceHT: proposed,
          currentMarginRate:
            Number(product.priceHt) > 0
              ? Math.round(
                  (1 - purchasePrice / Number(product.priceHt)) * 10000,
                ) / 100
              : null,
        });
      }
    } else {
      missingPurchasePrice += 1;
      const diagnosis = missingReason("product", product.id, product.sourceData, product.variants.length > 0);
      missingLines.push({ targetType: "product", id: product.id, code: product.code, name: product.name, ...diagnosis });
    }

    for (const variant of product.variants) {
      const variantPurchase = extractPurchasePriceFromSourceData(variant.sourceData);
      if (variantPurchase !== null) {
        const proposed = calculateSellingPriceHT(variantPurchase, rule);
        if (proposed !== null) {
          lines.push({
            targetType: "variant",
            id: variant.id,
            code: variant.code,
            name: variant.name,
            purchasePriceHT: variantPurchase,
            currentSellingPriceHT: Number(variant.priceHt),
            proposedSellingPriceHT: proposed,
            currentMarginRate:
              Number(variant.priceHt) > 0
                ? Math.round(
                    (1 - variantPurchase / Number(variant.priceHt)) * 10000,
                  ) / 100
                : null,
          });
        }
      } else {
        missingPurchasePrice += 1;
        const diagnosis = missingReason("variant", variant.id, variant.sourceData, false);
        missingLines.push({ targetType: "variant", id: variant.id, code: variant.code, name: variant.name, ...diagnosis });
      }
    }
  }

  return {
    supplier: { id: supplier.id, name: supplier.name },
    rule,
    affectedCount: lines.length,
    missingPurchasePrice,
    blockingMissingPurchasePrice: missingLines.filter((line) => line.blocking).length,
    validNoPriceCount: missingLines.filter((line) => !line.blocking).length,
    missingBreakdown: {
      parentWithVariants: missingLines.filter((line) => line.classification === "parent_with_variants").length,
      supplierConsult: missingLines.filter((line) => line.classification === "supplier_consult").length,
      catalogLinkMissing: missingLines.filter((line) => line.classification === "catalog_link_missing").length,
      realAnomaly: missingLines.filter((line) => line.blocking && line.classification !== "catalog_link_missing").length,
    },
    missingLines,
    lines,
  };
}


function stockmanPurchasePriceUnavailable(sourceData: Prisma.JsonValue | null) {
  if (!sourceData || typeof sourceData !== "object" || Array.isArray(sourceData)) {
    return false;
  }
  const root = sourceData as Record<string, unknown>;
  if (!root.stockman || typeof root.stockman !== "object" || Array.isArray(root.stockman)) {
    return false;
  }
  return (root.stockman as Record<string, unknown>).purchasePriceUnavailable === true;
}

function isCommerciallyUnavailableStockmanError(message: string | null | undefined) {
  const normalized = (message || "").toLocaleLowerCase("fr");
  return (
    normalized.includes("nous consulter") ||
    normalized.includes("produit arrêté") ||
    normalized.includes("produit arrete") ||
    normalized.includes("données commerciales introuvables") ||
    normalized.includes("donnees commerciales introuvables") ||
    normalized.includes("prix=?")
  );
}

function mergeStockmanUnavailablePrice(
  sourceData: Prisma.JsonValue | null,
  input: {
    reference: string;
    sourceUrl: string;
    reason: string;
  },
): Prisma.InputJsonValue {
  const root =
    sourceData && typeof sourceData === "object" && !Array.isArray(sourceData)
      ? { ...(sourceData as Record<string, unknown>) }
      : {};
  const previous =
    root.stockman && typeof root.stockman === "object" && !Array.isArray(root.stockman)
      ? { ...(root.stockman as Record<string, unknown>) }
      : {};

  return {
    ...root,
    stockman: {
      ...previous,
      reference: input.reference,
      sourceUrl: input.sourceUrl,
      purchasePriceUnavailable: true,
      purchasePriceUnavailableReason: input.reason,
      purchasePriceCheckedAt: new Date().toISOString(),
    },
  } as Prisma.InputJsonValue;
}

async function markStockmanPriceUnavailable(
  supplierId: string,
  candidate: {
    reference: string;
    sourceUrl: string;
    targetType: string | null;
    targetId: string | null;
  },
  reason: string,
) {
  if (!candidate.targetId) return false;

  if (candidate.targetType === "product") {
    const current = await prisma.product.findUnique({
      where: { id: candidate.targetId },
      select: { id: true, supplierId: true, sourceData: true },
    });
    if (!current || current.supplierId !== supplierId) return false;
    await prisma.product.update({
      where: { id: current.id },
      data: {
        sourceData: mergeStockmanUnavailablePrice(current.sourceData, {
          reference: candidate.reference,
          sourceUrl: candidate.sourceUrl,
          reason,
        }),
      },
    });
    return true;
  }

  if (candidate.targetType === "variant") {
    const current = await prisma.productVariant.findUnique({
      where: { id: candidate.targetId },
      select: {
        id: true,
        sourceData: true,
        product: { select: { supplierId: true } },
      },
    });
    if (!current || current.product.supplierId !== supplierId) return false;
    await prisma.productVariant.update({
      where: { id: current.id },
      data: {
        sourceData: mergeStockmanUnavailablePrice(current.sourceData, {
          reference: candidate.reference,
          sourceUrl: candidate.sourceUrl,
          reason,
        }),
      },
    });
    return true;
  }

  return false;
}

function mergeStockmanPurchasePrice(
  sourceData: Prisma.JsonValue | null,
  input: {
    reference: string;
    designation: string;
    sourceUrl: string;
    purchasePriceExVat: number;
    stock: number;
    weightKg: number | null;
    readAt: string;
  },
): Prisma.InputJsonValue {
  const root =
    sourceData && typeof sourceData === "object" && !Array.isArray(sourceData)
      ? { ...(sourceData as Record<string, unknown>) }
      : {};
  const previous =
    root.stockman && typeof root.stockman === "object" && !Array.isArray(root.stockman)
      ? { ...(root.stockman as Record<string, unknown>) }
      : {};

  return {
    ...root,
    stockman: {
      ...previous,
      reference: input.reference,
      designation: input.designation,
      sourceUrl: input.sourceUrl,
      purchasePriceExVat: input.purchasePriceExVat,
      stock: input.stock,
      weightKg: input.weightKg,
      readAt: input.readAt,
      pricingBackfilledAt: new Date().toISOString(),
    },
  } as Prisma.InputJsonValue;
}

async function getStockmanBackfillCandidates(supplierId: string, limit: number) {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: { id: true, name: true },
  });
  if (!supplier) return { supplier: null, candidates: [], eligibleCount: 0 };
  if (supplier.name.trim().toLocaleLowerCase("fr") !== "stockman") {
    return { supplier, candidates: [], eligibleCount: 0 };
  }

  const living = await prisma.stockmanCatalogReference.findMany({
    where: {
      isActive: true,
      targetType: { in: ["product", "variant"] },
      targetId: { not: null },
      sourceUrl: { not: "" },
    },
    select: {
      reference: true,
      designation: true,
      sourceUrl: true,
      targetType: true,
      targetId: true,
      productId: true,
    },
    orderBy: { reference: "asc" },
  });

  const productIds = living
    .filter((item) => item.targetType === "product" && item.targetId)
    .map((item) => item.targetId as string);
  const variantIds = living
    .filter((item) => item.targetType === "variant" && item.targetId)
    .map((item) => item.targetId as string);

  const [products, variants] = await Promise.all([
    productIds.length
      ? prisma.product.findMany({
          where: { id: { in: productIds }, supplierId },
          select: { id: true, sourceData: true },
        })
      : [],
    variantIds.length
      ? prisma.productVariant.findMany({
          where: { id: { in: variantIds }, product: { supplierId } },
          select: { id: true, productId: true, sourceData: true },
        })
      : [],
  ]);

  const productMap = new Map(products.map((item) => [item.id, item]));
  const variantMap = new Map(variants.map((item) => [item.id, item]));

  const eligible = living.filter((item) => {
    if (!item.targetId) return false;
    if (item.targetType === "product") {
      const product = productMap.get(item.targetId);
      return Boolean(
        product &&
          extractPurchasePriceFromSourceData(product.sourceData) === null &&
          !stockmanPurchasePriceUnavailable(product.sourceData),
      );
    }
    if (item.targetType === "variant") {
      const variant = variantMap.get(item.targetId);
      return Boolean(
        variant &&
          extractPurchasePriceFromSourceData(variant.sourceData) === null &&
          !stockmanPurchasePriceUnavailable(variant.sourceData),
      );
    }
    return false;
  });

  return {
    supplier,
    eligibleCount: eligible.length,
    candidates: eligible.slice(0, limit),
  };
}

async function backfillStockmanPurchasePrices(supplierId: string, batchSize: number) {
  const selection = await getStockmanBackfillCandidates(supplierId, batchSize);
  if (!selection.supplier) return { status: "supplier_missing" as const };
  if (selection.supplier.name.trim().toLocaleLowerCase("fr") !== "stockman") {
    return { status: "not_stockman" as const };
  }

  if (!selection.candidates.length) {
    return {
      status: "ok" as const,
      processed: 0,
      updated: 0,
      reused: 0,
      skipped: 0,
      failed: 0,
      remaining: 0,
      errors: [] as Array<{ reference: string; message: string }>,
    };
  }

  // V2.11.1 — sortie STOCKMAN : avant toute nouvelle lecture intranet,
  // réutiliser les prix déjà lus par le pipeline Stockman et conservés dans
  // StockmanImportDraft. Ce ne sont pas des prix Excel : ces brouillons sont
  // alimentés par la source fournisseur. On ne retourne sur l'intranet que
  // pour les vrais trous restants.
  const candidateReferences = Array.from(
    new Set(selection.candidates.map((item) => item.reference.trim()).filter(Boolean)),
  );
  const drafts = candidateReferences.length
    ? await prisma.stockmanImportDraft.findMany({
        where: { reference: { in: candidateReferences } },
        select: {
          reference: true,
          designation: true,
          sourceUrl: true,
          purchasePriceExVat: true,
          stock: true,
          weightKg: true,
          sourceReadAt: true,
        },
      })
    : [];
  const draftByReference = new Map(drafts.map((draft) => [draft.reference.trim(), draft]));

  let updated = 0;
  let reused = 0;
  let skipped = 0;
  let failed = 0;
  const errors: Array<{ reference: string; message: string }> = [];
  const candidatesNeedingLiveRead: typeof selection.candidates = [];

  for (const candidate of selection.candidates) {
    const draft = draftByReference.get(candidate.reference.trim());
    const draftPrice = draft?.purchasePriceExVat === null || draft?.purchasePriceExVat === undefined
      ? null
      : Number(draft.purchasePriceExVat);

    if (!draft || draftPrice === null || !Number.isFinite(draftPrice) || draftPrice <= 0) {
      candidatesNeedingLiveRead.push(candidate);
      continue;
    }

    const recovered = {
      reference: candidate.reference,
      designation: draft.designation || candidate.reference,
      sourceUrl: draft.sourceUrl || candidate.sourceUrl,
      purchasePriceExVat: draftPrice,
      stock: draft.stock ?? 0,
      weightKg: draft.weightKg === null ? null : Number(draft.weightKg),
      readAt: (draft.sourceReadAt ?? new Date()).toISOString(),
    };

    if (!candidate.targetId) continue;
    if (candidate.targetType === "product") {
      const current = await prisma.product.findUnique({
        where: { id: candidate.targetId },
        select: { id: true, supplierId: true, sourceData: true },
      });
      if (!current || current.supplierId !== supplierId) continue;
      await prisma.product.update({
        where: { id: current.id },
        data: { sourceData: mergeStockmanPurchasePrice(current.sourceData, recovered) },
      });
      updated += 1;
      reused += 1;
    } else {
      const current = await prisma.productVariant.findUnique({
        where: { id: candidate.targetId },
        select: { id: true, sourceData: true, product: { select: { supplierId: true } } },
      });
      if (!current || current.product.supplierId !== supplierId) continue;
      await prisma.productVariant.update({
        where: { id: current.id },
        data: { sourceData: mergeStockmanPurchasePrice(current.sourceData, recovered) },
      });
      updated += 1;
      reused += 1;
    }
  }

  const liveReads = candidatesNeedingLiveRead.length
    ? await getStockmanProducts(
        candidatesNeedingLiveRead.map((item) => ({
          reference: item.reference,
          productUrl: item.sourceUrl,
        })),
      )
    : [];

  for (let index = 0; index < candidatesNeedingLiveRead.length; index += 1) {
    const candidate = candidatesNeedingLiveRead[index];
    const live = liveReads[index];

    if (!live?.product) {
      const message = live?.error || "Lecture Stockman impossible.";

      if (isCommerciallyUnavailableStockmanError(message)) {
        const marked = await markStockmanPriceUnavailable(
          supplierId,
          candidate,
          message,
        );
        if (marked) {
          skipped += 1;
          continue;
        }
      }

      failed += 1;
      errors.push({
        reference: candidate.reference,
        message,
      });
      continue;
    }

    const product = live.product;
    if (!Number.isFinite(product.purchasePriceExVat) || product.purchasePriceExVat <= 0) {
      const reason = "Prix d’achat intranet indisponible / nous consulter.";
      const marked = await markStockmanPriceUnavailable(
        supplierId,
        candidate,
        reason,
      );
      if (marked) {
        skipped += 1;
        continue;
      }

      failed += 1;
      errors.push({
        reference: candidate.reference,
        message: reason,
      });
      continue;
    }

    if (!candidate.targetId) continue;

    if (candidate.targetType === "product") {
      const current = await prisma.product.findUnique({
        where: { id: candidate.targetId },
        select: { id: true, supplierId: true, sourceData: true },
      });
      if (!current || current.supplierId !== supplierId) continue;

      await prisma.product.update({
        where: { id: current.id },
        data: {
          sourceData: mergeStockmanPurchasePrice(current.sourceData, product),
        },
      });
      updated += 1;
    } else if (candidate.targetType === "variant") {
      const current = await prisma.productVariant.findUnique({
        where: { id: candidate.targetId },
        select: {
          id: true,
          sourceData: true,
          product: { select: { supplierId: true } },
        },
      });
      if (!current || current.product.supplierId !== supplierId) continue;

      await prisma.productVariant.update({
        where: { id: current.id },
        data: {
          sourceData: mergeStockmanPurchasePrice(current.sourceData, product),
        },
      });
      updated += 1;
    }
  }

  const remainingSelection = await getStockmanBackfillCandidates(supplierId, 1);

  return {
    status: "ok" as const,
    processed: selection.candidates.length,
    updated,
    reused,
    skipped,
    failed,
    remaining: remainingSelection.eligibleCount,
    errors: errors.slice(0, 10),
  };
}

export async function GET() {
  const denied = await authorize(false);
  if (denied) return denied;

  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      isActive: true,
      _count: { select: { products: true } },
    },
  });

  const settings = await prisma.siteSetting.findMany({
    where: { key: { startsWith: "supplier-pricing:" } },
    select: { key: true, value: true },
  });
  const rules = new Map(
    settings.map((setting) => [
      setting.key.replace("supplier-pricing:", ""),
      normalizePricingRule(setting.value),
    ]),
  );

  return NextResponse.json({
    suppliers: suppliers.map((supplier) => ({
      id: supplier.id,
      name: supplier.name,
      isActive: supplier.isActive,
      productCount: supplier._count.products,
      rule: rules.get(supplier.id) ?? { ...DEFAULT_SUPPLIER_PRICING_RULE },
    })),
    formula: "PV HT = PA HT ajusté ÷ (1 - marge / 100)",
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Paramètres de tarification invalides." },
      { status: 400 },
    );
  }

  const denied = await authorize(parsed.data.action !== "preview");
  if (denied) return denied;

  const { supplierId, rule } = parsed.data;

  if (parsed.data.action === "backfill_stockman_purchase_prices") {
    const result = await backfillStockmanPurchasePrices(
      supplierId,
      parsed.data.batchSize ?? 20,
    );

    if (result.status === "supplier_missing") {
      return NextResponse.json({ message: "Fournisseur introuvable." }, { status: 404 });
    }
    if (result.status === "not_stockman") {
      return NextResponse.json(
        { message: "Le rattrapage intranet est réservé au fournisseur STOCKMAN." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ...result,
      message:
        result.processed === 0
          ? "Tous les prix d’achat Stockman exploitables sont déjà renseignés."
          : `${result.updated} prix d’achat récupéré(s) · ${result.skipped} référence(s) sans tarif fournisseur ignorée(s) · ${result.failed} échec(s) technique(s) · ${result.remaining} encore à récupérer.`,
    });
  }

  if (parsed.data.action === "save_rule") {
    await persistRule(supplierId, rule);
    return NextResponse.json({
      saved: true,
      rule,
      message: "Règle fournisseur enregistrée. Aucun prix n’a encore été modifié.",
    });
  }

  const preview = await buildSupplierPreview(supplierId, rule);
  if (!preview) {
    return NextResponse.json({ message: "Fournisseur introuvable." }, { status: 404 });
  }

  if (parsed.data.action === "preview") {
    return NextResponse.json({ preview });
  }

  if (parsed.data.action === "apply_arbitrage") {
    await persistRule(supplierId, rule);

    const allowed = new Map(
      preview.lines.map((line) => [
        `${line.targetType}:${line.id}`,
        line,
      ]),
    );

    const updates: Array<{
      targetType: "product" | "variant";
      id: string;
      priceHT: number;
      mode: "current" | "calculated" | "manual";
    }> = [];

    for (const decision of parsed.data.decisions) {
      const line = allowed.get(`${decision.targetType}:${decision.id}`);
      if (!line) continue;

      let priceHT = line.currentSellingPriceHT;
      if (decision.mode === "calculated") {
        priceHT = line.proposedSellingPriceHT;
      } else if (decision.mode === "manual") {
        const manual = decision.manualPriceHT ?? null;
        if (manual === null || !Number.isFinite(manual) || manual <= 0) continue;
        priceHT = Math.round((manual + Number.EPSILON) * 100) / 100;
      }

      if (!Number.isFinite(priceHT) || priceHT < 0) continue;
      updates.push({
        targetType: decision.targetType,
        id: decision.id,
        priceHT,
        mode: decision.mode,
      });
    }

    await prisma.$transaction(
      async (tx) => {
        for (const update of updates) {
          if (update.targetType === "product") {
            await tx.product.update({
              where: { id: update.id },
              data: { priceHt: update.priceHT },
            });
          } else {
            await tx.productVariant.update({
              where: { id: update.id },
              data: { priceHt: update.priceHT },
            });
          }
        }
      },
      {
        maxWait: 10_000,
        timeout: 30_000,
      },
    );

    const summary = {
      current: updates.filter((item) => item.mode === "current").length,
      calculated: updates.filter((item) => item.mode === "calculated").length,
      manual: updates.filter((item) => item.mode === "manual").length,
    };

    return NextResponse.json({
      version: "V2.11.1.4",
      applied: updates.length,
      summary,
      rule,
      message: `${updates.length} prix retenu(s) appliqué(s) · ${summary.current} conservé(s) · ${summary.calculated} calculé(s) · ${summary.manual} manuel(s).`,
    });
  }

  await persistRule(supplierId, rule);

  const productUpdates = preview.lines.filter((line) => line.targetType === "product");
  const variantUpdates = preview.lines.filter((line) => line.targetType === "variant");

  await prisma.$transaction(
    async (tx) => {
      for (const line of productUpdates) {
        await tx.product.update({
          where: { id: line.id },
          data: { priceHt: line.proposedSellingPriceHT },
        });
      }

      for (const line of variantUpdates) {
        await tx.productVariant.update({
          where: { id: line.id },
          data: { priceHt: line.proposedSellingPriceHT },
        });
      }
    },
    {
      maxWait: 10_000,
      timeout: 30_000,
    },
  );

  return NextResponse.json({
    applied: preview.affectedCount,
    missingPurchasePrice: preview.missingPurchasePrice,
    rule,
    sample: preview.lines.slice(0, 25).map((line) => ({
      ...line,
      purchasePriceHT: money(line.purchasePriceHT),
      currentSellingPriceHT: money(line.currentSellingPriceHT),
      proposedSellingPriceHT: money(line.proposedSellingPriceHT),
    })),
    message: `${preview.affectedCount} prix de vente recalculé(s). ${preview.missingPurchasePrice} référence(s) sans prix d’achat ont été ignorées.`,
  });
}
