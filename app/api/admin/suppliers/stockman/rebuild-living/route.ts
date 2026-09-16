import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db/prisma";
import { getStockmanCommercialFamily, getStockmanCommercialFamilyDiagnostic, getStockmanProducts } from "@/lib/suppliers/stockman/client";
import { resolveStockmanCategory } from "@/lib/suppliers/stockman/category";
import { buildStockmanSeo } from "@/lib/suppliers/stockman/seo";
import type { StockmanProduct } from "@/lib/suppliers/stockman/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const executeSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("execute_batch"),
    familyLimit: z.number().int().min(1).max(5).optional(),
  }),
  z.object({
    action: z.literal("retry_blocked"),
  }),
  z.object({
    action: z.literal("diagnose_blocked"),
    familyOffset: z.number().int().min(0).optional(),
    familyLimit: z.number().int().min(1).max(3).optional(),
  }),
  z.object({
    action: z.literal("diagnose_remaining"),
    familyOffset: z.number().int().min(0).optional(),
    familyLimit: z.number().int().min(1).max(2).optional(),
  }),
]);

async function authorize(write = false) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== "ACTIVE") {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }
  if (write && admin.role === "READ_ONLY") {
    return NextResponse.json(
      { message: "Votre rôle ne permet pas de reconstruire le catalogue." },
      { status: 403 },
    );
  }
  return null;
}

function normalizeUrl(value: string) {
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return value.split("?")[0].split("#")[0];
  }
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "stockman";
}

async function uniqueSlug(baseValue: string) {
  const base = slugify(baseValue);
  let candidate = base;
  let suffix = 2;
  while (await prisma.product.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function familyCodeFromUrl(sourceUrl: string, fallbackReference: string) {
  try {
    const path = decodeURIComponent(new URL(sourceUrl).pathname);
    const match = path.match(/--([^/]+)\.aspx$/i);
    if (match?.[1]) return match[1].trim().toUpperCase();
  } catch {
    // fallback below
  }

  const normalized = fallbackReference.trim().toUpperCase();
  const prefix = normalized.match(/^[A-Z]+(?:[-][A-Z]+)?/);
  return prefix?.[0] || normalized;
}

function cleanStockmanDesignation(value: string) {
  return value
    .replace(/\s*Plus d['’]infos ici\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanFamilyName(category: string | null, fallback: string, familyCode: string) {
  const raw = cleanStockmanDesignation(category?.trim() || fallback.trim());
  if (!raw) return `Famille ${familyCode}`;
  const escaped = familyCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return cleanStockmanDesignation(
    raw.replace(new RegExp(`^${escaped}\\s*[-–—:]?\\s*`, "i"), ""),
  ) || raw;
}

function dedupeByUrl<T extends { url: string }>(items: T[] | undefined) {
  if (!items?.length) return [];
  return Array.from(new Map(items.map((item) => [item.url, item])).values());
}

async function supplierId() {
  const supplier = await prisma.supplier.findFirst({
    where: {
      OR: [
        { name: { equals: "STOCKMAN", mode: "insensitive" } },
        { slug: { equals: "stockman", mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  return supplier?.id ?? null;
}

async function livingState() {
  const refs = await prisma.stockmanCatalogReference.findMany({
    where: { isActive: true },
    select: {
      id: true,
      reference: true,
      designation: true,
      category: true,
      sourceUrl: true,
      targetType: true,
      targetId: true,
      productId: true,
      lastMatchStatus: true,
      lastMatchMethod: true,
    },
    orderBy: [{ sourceUrl: "asc" }, { reference: "asc" }],
  });

  const groups = new Map<string, typeof refs>();
  for (const ref of refs) {
    const key = normalizeUrl(ref.sourceUrl);
    const current = groups.get(key) ?? [];
    current.push(ref);
    groups.set(key, current);
  }

  const families = Array.from(groups.entries()).map(([sourceUrl, items]) => {
    const linked = items.every((item) => Boolean(item.targetId && item.productId));
    const ignored = items.every((item) =>
      item.lastMatchStatus === "ignored_non_commercial"
      || item.lastMatchStatus === "ignored_navigation"
      || item.lastMatchStatus === "ignored_duplicate_source"
    );
    const blocked = items.some((item) => item.lastMatchStatus === "rebuild_blocked");
    const partiallyLinked = items.some((item) => Boolean(item.targetId || item.productId))
      && !items.every((item) =>
        Boolean(item.targetId && item.productId)
        || item.lastMatchStatus === "ignored_non_commercial"
        || item.lastMatchStatus === "ignored_navigation"
        || item.lastMatchStatus === "ignored_duplicate_source"
      );
    return { sourceUrl, items, linked, ignored, blocked, partiallyLinked };
  });

  return {
    refs,
    families,
    unbuilt: families.filter((family) => !family.linked && !family.ignored && !family.blocked),
    blocked: families.filter((family) => family.blocked && !family.linked),
    partial: families.filter((family) => family.partiallyLinked),
  };
}

function productSourceData(input: {
  sourceUrl: string;
  familyCode: string;
  references: string[];
  live?: StockmanProduct;
  singleReference?: string;
}): Prisma.InputJsonValue {
  return {
    stockman: {
      sourceUrl: input.sourceUrl,
      familyCode: input.familyCode,
      familyReferences: input.references,
      reference: input.singleReference ?? null,
      purchasePriceExVat:
        input.singleReference && input.live && input.live.purchasePriceExVat > 0
          ? input.live.purchasePriceExVat
          : null,
      stock: input.singleReference ? input.live?.stock ?? 0 : null,
      weightKg: input.singleReference ? input.live?.weightKg ?? null : null,
      rebuiltFromLivingCatalogueAt: new Date().toISOString(),
      source: "living_catalogue",
    },
  };
}

function variantSourceData(live: StockmanProduct): Prisma.InputJsonValue {
  return {
    stockman: {
      reference: live.reference,
      designation: live.designation,
      sourceUrl: live.sourceUrl,
      purchasePriceExVat: live.purchasePriceExVat > 0 ? live.purchasePriceExVat : null,
      stock: live.stock,
      stockLabel: live.stockOnRequest ? "Nous consulter" : String(live.stock),
      weightKg: live.weightKg,
      sourceReadAt: live.readAt,
      rebuiltFromLivingCatalogueAt: new Date().toISOString(),
      source: "living_catalogue",
    },
  };
}


function normalizeRef(value: string) {
  return value.trim().toUpperCase();
}

function classifyReadError(error: string | undefined) {
  const value = (error ?? "").toLowerCase();
  if (!value) return "unknown";
  if (value.includes("référence absente") || value.includes("reference absente")) return "reference_absent_from_page";
  if (value.includes("prix") && (value.includes("introuvable") || value.includes("impossible"))) return "price_not_readable";
  if (value.includes("stock") && (value.includes("introuvable") || value.includes("impossible"))) return "stock_not_readable";
  if (value.includes("auth") || value.includes("connexion") || value.includes("login")) return "authentication";
  if (value.includes("timeout") || value.includes("délai") || value.includes("delai")) return "timeout";
  if (value.includes("redirect")) return "redirect";
  return "reader_error";
}

async function diagnoseBlockedFamily(
  family: Awaited<ReturnType<typeof livingState>>["blocked"][number],
) {
  const expected = family.items.map((item) => item.reference);
  const reads = await getStockmanProducts(
    family.items.map((item) => ({
      reference: item.reference,
      productUrl: item.sourceUrl,
    })),
  );

  const readable: Array<{
    reference: string;
    purchasePriceExVat: number;
    stock: number;
    weightKg: number | null;
  }> = [];
  const failures: Array<{
    reference: string;
    reason: string;
    error: string;
  }> = [];

  reads.forEach((read, index) => {
    const expectedReference = expected[index] ?? "?";
    if (read.product) {
      readable.push({
        reference: read.product.reference,
        purchasePriceExVat: read.product.purchasePriceExVat,
        stock: read.product.stock,
        weightKg: read.product.weightKg,
      });
      return;
    }
    failures.push({
      reference: expectedReference,
      reason: classifyReadError(read.error),
      error: read.error ?? "Lecture Stockman impossible sans détail.",
    });
  });

  const familyCode = familyCodeFromUrl(family.sourceUrl, expected[0] ?? "");
  const expectedSet = new Set(expected.map(normalizeRef));
  const readableSet = new Set(readable.map((item) => normalizeRef(item.reference)));
  const missing = expected.filter((reference) => !readableSet.has(normalizeRef(reference)));
  const unexpected = readable
    .map((item) => item.reference)
    .filter((reference) => !expectedSet.has(normalizeRef(reference)));

  const parentOnlyMissing =
    missing.length === 1 && normalizeRef(missing[0]) === normalizeRef(familyCode);

  let pattern = "mixed_reader_failures";
  if (readable.length === 0) pattern = "no_commercial_row_readable";
  else if (parentOnlyMissing) pattern = "family_header_only";
  else if (failures.length === 0 && unexpected.length === 0) pattern = "fully_readable_now";
  else if (failures.length === 1) pattern = failures[0].reason;
  else if (failures.length > 0 && new Set(failures.map((item) => item.reason)).size === 1) {
    pattern = failures[0].reason;
  }

  return {
    sourceUrl: family.sourceUrl,
    familyCode,
    expected,
    readable,
    missing,
    unexpected,
    failures,
    pattern,
    lastMethods: Array.from(new Set(family.items.map((item) => item.lastMatchMethod).filter(Boolean))),
  };
}

async function rebuildFamily(
  family: Awaited<ReturnType<typeof livingState>>["unbuilt"][number],
  stockmanSupplierId: string,
) {
  if (family.partiallyLinked) {
    return {
      status: "error" as const,
      sourceUrl: family.sourceUrl,
      message: "Famille partiellement liée : reconstruction bloquée pour éviter un doublon.",
    };
  }

  const hint = family.items[0]?.reference;
  if (!hint) {
    return {
      status: "error" as const,
      sourceUrl: family.sourceUrl,
      message: "Famille Stockman sans référence de départ.",
    };
  }

  const commercialFamily = await getStockmanCommercialFamily(hint, family.sourceUrl);
  const now = new Date();

  // V2.10.18.0 : une page catégorie est seulement un noeud de navigation.
  // Elle ne crée jamais de produit et ne compte plus comme anomalie.
  if (commercialFamily.kind === "category_or_non_commercial" || commercialFamily.products.length === 0) {
    await prisma.stockmanCatalogReference.updateMany({
      where: { id: { in: family.items.map((item) => item.id) } },
      data: {
        lastMatchStatus: "ignored_navigation",
        lastMatchMethod: "final_living_catalogue",
        lastConfidence: 100,
        lastMissingKind: null,
        targetType: null,
        targetId: null,
        productId: null,
        targetReference: null,
      },
    });
    return {
      status: "ignored" as const,
      sourceUrl: family.sourceUrl,
      references: family.items.length,
      duplicateCommercialRows: 0,
      message: "Page de navigation Stockman ignorée : aucun produit créé.",
    };
  }

  const familyCode = commercialFamily.familyReference.trim().toUpperCase();
  const uniqueLiveProducts = Array.from(
    new Map(
      commercialFamily.products.map((item) => [item.reference.trim().toUpperCase(), item]),
    ).values(),
  );

  // Une référence Stockman est unique dans OYSTE. Le référentiel vivant indique
  // sa page canonique lorsqu'elle a sa propre fiche. Cela empêche qu'un accessoire
  // affiché sur DMEG/CT/etc. soit recréé comme variante s'il possède déjà sa fiche.
  const existingReferences = await prisma.stockmanCatalogReference.findMany({
    where: { reference: { in: uniqueLiveProducts.map((item) => item.reference) } },
    select: {
      reference: true,
      sourceUrl: true,
      targetType: true,
      targetId: true,
      productId: true,
    },
  });
  const referenceState = new Map(
    existingReferences.map((item) => [item.reference.trim().toUpperCase(), item]),
  );
  const familySourceUrl = normalizeUrl(family.sourceUrl);
  const exactFamilyRow = uniqueLiveProducts.find(
    (item) => item.reference.trim().toUpperCase() === familyCode,
  );

  const eligibleLiveProducts = uniqueLiveProducts.filter((live) => {
    const reference = live.reference.trim().toUpperCase();
    const known = referenceState.get(reference);

    // Déjà rattachée à un autre objet lors d'un batch précédent : jamais de doublon.
    if (known?.targetId && known.productId) return false;

    // Si Stockman possède une ligne commerciale portant exactement la référence
    // de la fiche, les lignes sans lien de référence avec cette fiche sont des
    // accessoires/options, pas des variantes du produit principal.
    if (exactFamilyRow && reference !== familyCode && !reference.startsWith(familyCode)) {
      return false;
    }

    // Si la référence a sa propre page canonique dans le scan vivant, elle sera
    // reconstruite sur cette page plutôt que comme variante d'une autre famille.
    if (known?.sourceUrl && normalizeUrl(known.sourceUrl) !== familySourceUrl) {
      return reference === familyCode;
    }

    return true;
  });

  const duplicateCommercialRows = uniqueLiveProducts.length - eligibleLiveProducts.length;

  // Une page peut ne contenir que des accessoires déjà possédés par leurs propres
  // fiches. Dans ce cas elle n'a rien à créer et devient un noeud ignoré proprement.
  if (eligibleLiveProducts.length === 0) {
    await prisma.stockmanCatalogReference.updateMany({
      where: { id: { in: family.items.map((item) => item.id) } },
      data: {
        lastMatchStatus: "ignored_duplicate_source",
        lastMatchMethod: "final_reference_deduplication",
        lastConfidence: 100,
        lastMissingKind: null,
        targetType: null,
        targetId: null,
        productId: null,
        targetReference: null,
      },
    });
    return {
      status: "ignored" as const,
      sourceUrl: commercialFamily.pageUrl,
      references: family.items.length,
      duplicateCommercialRows,
      message: `${duplicateCommercialRows} ligne(s) commerciale(s) déjà détenue(s) par leur fiche canonique : aucun doublon créé.`,
    };
  }

  const firstLive = eligibleLiveProducts[0];
  const familyName = cleanFamilyName(
    family.items[0]?.category ?? null,
    commercialFamily.familyDesignation,
    familyCode,
  );
  const category = await resolveStockmanCategory({
    sourceUrl: commercialFamily.pageUrl,
    designation: familyName,
    categoryHint: family.items[0]?.category ?? null,
  });
  const slug = await uniqueSlug(`${familyName}-${familyCode}`);
  const seo = buildStockmanSeo({
    ...firstLive,
    reference: familyCode,
    designation: familyName,
  });

  const images = dedupeByUrl(firstLive.images);
  const documents = dedupeByUrl(firstLive.documents);
  const features = firstLive.features ?? [];
  const commercialReferences = new Set(
    eligibleLiveProducts.map((item) => item.reference.trim().toUpperCase()),
  );
  const familyReferenceIsCommercial = commercialReferences.has(familyCode);
  const simpleProduct = eligibleLiveProducts.length === 1 && familyReferenceIsCommercial;
  const productId = randomUUID();

  await prisma.$transaction(async (tx) => {
    await tx.product.create({
      data: {
        id: productId,
        code: simpleProduct ? firstLive.reference : familyCode,
        supplierCode: simpleProduct ? firstLive.reference : familyCode,
        slug,
        name: simpleProduct ? cleanStockmanDesignation(firstLive.designation) : familyName,
        shortName: simpleProduct ? cleanStockmanDesignation(firstLive.designation) : familyName,
        description: firstLive.shortDescription?.trim() || null,
        detailedDescription: firstLive.detailedDescription?.trim() || null,
        priceHt: 0,
        minPriceHt: null,
        maxPriceHt: null,
        stock: simpleProduct ? firstLive.stock : 0,
        weightKg: simpleProduct ? firstLive.weightKg : null,
        shippingMode: "QUOTE",
        publicationStatus: "DRAFT",
        supplierId: stockmanSupplierId,
        categoryId: category?.id ?? null,
        seoTitle: seo.seoTitle,
        seoDescription: seo.seoDescription,
        sourceData: productSourceData({
          sourceUrl: commercialFamily.pageUrl,
          familyCode,
          references: eligibleLiveProducts.map((item) => item.reference),
          live: firstLive,
          singleReference: simpleProduct ? firstLive.reference : undefined,
        }),
        media: images.length ? {
          create: images.map((image, index) => ({
            type: "IMAGE",
            url: image.url,
            sourceUrl: image.url,
            altText: image.altText || familyName,
            isPrimary: index === 0,
            sortOrder: index,
          })),
        } : undefined,
        documents: documents.length ? {
          create: documents.map((document, index) => ({
            name: document.name,
            type: document.type,
            url: document.url,
            sourceUrl: document.url,
            isPublic: true,
            sortOrder: index,
          })),
        } : undefined,
        features: features.length ? {
          create: features.map((feature, index) => ({
            label: feature.label,
            value: feature.value,
            sortOrder: index,
          })),
        } : undefined,
      },
    });

    if (simpleProduct) {
      await tx.stockmanCatalogReference.upsert({
        where: { reference: firstLive.reference },
        create: {
          reference: firstLive.reference,
          designation: firstLive.designation,
          category: family.items[0]?.category ?? null,
          sourceUrl: commercialFamily.pageUrl,
          firstSeenAt: now,
          lastSeenAt: now,
          lastChangedAt: now,
          seenCount: 1,
          isActive: true,
          lastMatchStatus: "rebuilt",
          lastMatchMethod: "final_living_catalogue",
          lastConfidence: 100,
          targetType: "product",
          targetId: productId,
          productId,
          targetReference: firstLive.reference,
        },
        update: {
          designation: firstLive.designation,
          sourceUrl: commercialFamily.pageUrl,
          lastSeenAt: now,
          lastChangedAt: now,
          isActive: true,
          lastMatchStatus: "rebuilt",
          lastMatchMethod: "final_living_catalogue",
          lastConfidence: 100,
          lastMissingKind: null,
          targetType: "product",
          targetId: productId,
          productId,
          targetReference: firstLive.reference,
        },
      });
    } else {
      for (const live of eligibleLiveProducts) {
        const variantId = randomUUID();
        await tx.productVariant.create({
          data: {
            id: variantId,
            code: live.reference,
            supplierCode: live.reference,
            name: cleanStockmanDesignation(live.designation),
            label: cleanStockmanDesignation(live.designation),
            priceHt: 0,
            stock: live.stock,
            weightKg: live.weightKg,
            shippingMode: "QUOTE",
            sourceData: variantSourceData(live),
            productId,
            features: live.features?.length ? {
              create: live.features.map((feature, index) => ({
                label: feature.label,
                value: feature.value,
                sortOrder: index,
              })),
            } : undefined,
          },
        });

        await tx.stockmanCatalogReference.upsert({
          where: { reference: live.reference },
          create: {
            reference: live.reference,
            designation: live.designation,
            category: family.items[0]?.category ?? null,
            sourceUrl: commercialFamily.pageUrl,
            firstSeenAt: now,
            lastSeenAt: now,
            lastChangedAt: now,
            seenCount: 1,
            isActive: true,
            lastMatchStatus: "rebuilt",
            lastMatchMethod: "final_living_catalogue",
            lastConfidence: 100,
            targetType: "variant",
            targetId: variantId,
            productId,
            targetReference: live.reference,
          },
          update: {
            designation: live.designation,
            sourceUrl: commercialFamily.pageUrl,
            lastSeenAt: now,
            lastChangedAt: now,
            isActive: true,
            lastMatchStatus: "rebuilt",
            lastMatchMethod: "final_living_catalogue",
            lastConfidence: 100,
            lastMissingKind: null,
            targetType: "variant",
            targetId: variantId,
            productId,
            targetReference: live.reference,
          },
        });
      }

      // Si la référence de fiche n'est pas elle-même une ligne commerciale,
      // elle représente uniquement le produit parent OYSTE.
      if (!familyReferenceIsCommercial) {
        await tx.stockmanCatalogReference.upsert({
          where: { reference: familyCode },
          create: {
            reference: familyCode,
            designation: commercialFamily.familyDesignation,
            category: family.items[0]?.category ?? null,
            sourceUrl: commercialFamily.pageUrl,
            firstSeenAt: now,
            lastSeenAt: now,
            lastChangedAt: now,
            seenCount: 1,
            isActive: true,
            lastMatchStatus: "rebuilt_parent",
            lastMatchMethod: "final_living_catalogue",
            lastConfidence: 100,
            targetType: "product",
            targetId: productId,
            productId,
            targetReference: familyCode,
          },
          update: {
            designation: commercialFamily.familyDesignation,
            sourceUrl: commercialFamily.pageUrl,
            lastSeenAt: now,
            lastChangedAt: now,
            isActive: true,
            lastMatchStatus: "rebuilt_parent",
            lastMatchMethod: "final_living_catalogue",
            lastConfidence: 100,
            lastMissingKind: null,
            targetType: "product",
            targetId: productId,
            productId,
            targetReference: familyCode,
          },
        });
      }
    }

    // Nettoyage des faux tokens historiques appartenant à CETTE page uniquement.
    const validRefs = new Set([
      familyCode,
      ...eligibleLiveProducts.map((item) => item.reference.trim().toUpperCase()),
    ]);
    const falseItems = family.items.filter(
      (item) => !validRefs.has(item.reference.trim().toUpperCase()),
    );
    if (falseItems.length) {
      await tx.stockmanCatalogReference.updateMany({
        where: { id: { in: falseItems.map((item) => item.id) } },
        data: {
          isActive: false,
          lastMatchStatus: "ignored_non_commercial",
          lastMatchMethod: "final_living_catalogue",
          lastConfidence: 100,
          lastMissingKind: null,
          targetType: null,
          targetId: null,
          productId: null,
          targetReference: null,
        },
      });
    }
  });

  return {
    status: "created" as const,
    sourceUrl: commercialFamily.pageUrl,
    familyCode,
    productId,
    references: simpleProduct ? 1 : eligibleLiveProducts.length + (familyReferenceIsCommercial ? 0 : 1),
    variants: simpleProduct ? 0 : eligibleLiveProducts.length,
    duplicateCommercialRows,
    ignoredLegacyReferences: family.items.filter((item) =>
      item.reference.trim().toUpperCase() !== familyCode
      && !commercialReferences.has(item.reference.trim().toUpperCase())
    ).length,
  };
}

export async function GET() {
  const denied = await authorize(false);
  if (denied) return denied;

  const supplier = await supplierId();
  if (!supplier) {
    return NextResponse.json({ message: "Fournisseur STOCKMAN introuvable." }, { status: 404 });
  }

  const state = await livingState();
  return NextResponse.json({
    activeReferences: state.refs.length,
    families: state.families.length,
    builtFamilies: state.families.filter((family) => family.linked).length,
    ignoredFamilies: state.families.filter((family) => family.ignored).length,
    remainingFamilies: state.unbuilt.length,
    partiallyLinkedFamilies: state.partial.length,
    blockedFamilies: state.blocked.length,
    blockedReferences: state.blocked.reduce((sum, family) => sum + family.items.length, 0),
    blocked: state.blocked.map((family) => ({
      sourceUrl: family.sourceUrl,
      references: family.items.map((item) => item.reference),
    })),
    remainingReferences: state.unbuilt.reduce((sum, family) => sum + family.items.length, 0),
    ready: state.partial.length === 0,
  });
}

export async function POST(request: Request) {
  const denied = await authorize(true);
  if (denied) return denied;

  const parsed = executeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Paramètres de reconstruction invalides." }, { status: 400 });
  }

  const stockmanSupplierId = await supplierId();
  if (!stockmanSupplierId) {
    return NextResponse.json({ message: "Fournisseur STOCKMAN introuvable." }, { status: 404 });
  }

  if (parsed.data.action === "diagnose_remaining") {
    const state = await livingState();
    const offset = parsed.data.familyOffset ?? 0;
    const limit = parsed.data.familyLimit ?? 2;
    const batch = state.unbuilt.slice(offset, offset + limit);
    const families = [];

    for (const family of batch) {
      const hint = family.items[0]?.reference;
      if (!hint) continue;

      try {
        const diagnostic = await getStockmanCommercialFamilyDiagnostic(hint, family.sourceUrl);
        families.push({
          sourceUrl: family.sourceUrl,
          knownReferences: family.items.map((item) => item.reference),
          knownReferenceCount: family.items.length,
          ...diagnostic,
        });
      } catch (error) {
        families.push({
          sourceUrl: family.sourceUrl,
          knownReferences: family.items.map((item) => item.reference),
          knownReferenceCount: family.items.length,
          referenceHint: hint,
          finalUrl: family.sourceUrl,
          pageTitle: "",
          familyReference: familyCodeFromUrl(family.sourceUrl, hint),
          followedDetailUrl: null,
          commercialCandidateRows: 0,
          acceptedCommercialRows: 0,
          rows: [],
          kind: "category_or_non_commercial",
          reason: error instanceof Error ? error.message : "Diagnostic impossible.",
          diagnosticError: true,
        });
      }
    }

    // V2.10.17.7 : une page catégorie est un état normal de navigation, pas une anomalie.
    // Les anomalies restantes ne concernent désormais que les vraies fiches produit
    // ou les erreurs techniques de diagnostic.
    const patternCounts = families.reduce<Record<string, number>>((acc, family) => {
      let pattern: string;
      if (family.diagnosticError) pattern = "diagnostic_error";
      else if (family.kind === "category_or_non_commercial") pattern = "navigation_category";
      else if (family.acceptedCommercialRows > 0) pattern = "commercial_rows_readable";
      else if (family.followedDetailUrl) pattern = "product_detail_without_commercial_rows";
      else pattern = "product_page_without_commercial_rows";
      acc[pattern] = (acc[pattern] ?? 0) + 1;
      return acc;
    }, {});

    const trueAnomalyCount = families.filter((family) =>
      Boolean(family.diagnosticError)
      || (family.kind === "product_page" && family.acceptedCommercialRows === 0)
    ).length;

    return NextResponse.json({
      totalRemainingFamilies: state.unbuilt.length,
      totalRemainingReferences: state.unbuilt.reduce((sum, family) => sum + family.items.length, 0),
      offset,
      processedFamilies: families.length,
      nextOffset: offset + families.length,
      finished: offset + families.length >= state.unbuilt.length,
      patternCounts,
      trueAnomalyCount,
      navigationCategoryCount: families.filter((family) => family.kind === "category_or_non_commercial" && !family.diagnosticError).length,
      families,
    });
  }

  if (parsed.data.action === "diagnose_blocked") {
    const state = await livingState();
    const offset = parsed.data.familyOffset ?? 0;
    const limit = parsed.data.familyLimit ?? 2;
    const batch = state.blocked.slice(offset, offset + limit);
    const families = [];

    for (const family of batch) {
      families.push(await diagnoseBlockedFamily(family));
    }

    const patternCounts = families.reduce<Record<string, number>>((acc, family) => {
      acc[family.pattern] = (acc[family.pattern] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      totalBlockedFamilies: state.blocked.length,
      totalBlockedReferences: state.blocked.reduce((sum, family) => sum + family.items.length, 0),
      offset,
      processedFamilies: families.length,
      nextOffset: offset + families.length,
      finished: offset + families.length >= state.blocked.length,
      patternCounts,
      families,
    });
  }

  if (parsed.data.action === "retry_blocked") {
    const reset = await prisma.stockmanCatalogReference.updateMany({
      where: {
        isActive: true,
        lastMatchStatus: "rebuild_blocked",
        targetId: null,
        productId: null,
      },
      data: {
        lastMatchStatus: null,
        lastMatchMethod: null,
        lastConfidence: null,
        lastMissingKind: null,
      },
    });
    const state = await livingState();
    return NextResponse.json({
      resetReferences: reset.count,
      remainingFamilies: state.unbuilt.length,
      remainingReferences: state.unbuilt.reduce((sum, family) => sum + family.items.length, 0),
    });
  }

  const before = await livingState();
  if (before.partial.length) {
    return NextResponse.json(
      { message: `${before.partial.length} famille(s) sont partiellement liées. Reconstruction arrêtée pour éviter les doublons.` },
      { status: 409 },
    );
  }

  const batch = before.unbuilt.slice(0, parsed.data.familyLimit ?? 3);
  const results = [];
  for (const family of batch) {
    results.push(await rebuildFamily(family, stockmanSupplierId));
  }

  const after = await livingState();
  const created = results.filter((result) => result.status === "created");
  const errors = results.filter((result) => result.status === "error");
  const skipped = results.filter((result) => result.status === "ignored");

  return NextResponse.json({
    processedFamilies: batch.length,
    createdFamilies: created.length,
    createdReferences: created.reduce((sum, result) => sum + ("references" in result ? result.references : 0), 0),
    createdVariants: created.reduce((sum, result) => sum + ("variants" in result ? result.variants : 0), 0),
    duplicateCommercialRows: results.reduce((sum, result) =>
      sum + ("duplicateCommercialRows" in result ? Number(result.duplicateCommercialRows || 0) : 0), 0),
    ignoredFamilies: skipped.length,
    errors: errors.map((result) => ({
      sourceUrl: result.sourceUrl,
      message: result.message,
    })),
    skipped: skipped.map((result) => ({
      sourceUrl: result.sourceUrl,
      references: "references" in result ? result.references : [],
      message: result.message,
    })),
    blockedFamilies: after.blocked.length,
    blockedReferences: after.blocked.reduce((sum, family) => sum + family.items.length, 0),
    remainingFamilies: after.unbuilt.length,
    remainingReferences: after.unbuilt.reduce((sum, family) => sum + family.items.length, 0),
    finished: after.unbuilt.length === 0,
  });
}
