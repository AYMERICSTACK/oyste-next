import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db/prisma";
import { getStockmanProducts } from "@/lib/suppliers/stockman/client";
import type { StockmanProduct } from "@/lib/suppliers/stockman/types";
import { resolveStockmanCategory } from "@/lib/suppliers/stockman/category";
import { buildStockmanSeo } from "@/lib/suppliers/stockman/seo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  action: z.literal("create_products"),
  draftIds: z.array(z.string().min(1)).min(1).max(50),
});

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "produit-stockman";
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

async function stockmanSupplierId() {
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

async function authorize(write = false) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== "ACTIVE") {
    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  }
  if (write && admin.role === "READ_ONLY") {
    return NextResponse.json({ message: "Votre rôle ne permet pas de créer des produits." }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await authorize(false);
  if (denied) return denied;

  // V2.12.8.4.1 — garde-fou : une simple lecture du BO ne doit JAMAIS
  // supprimer des brouillons. Le référentiel persistant peut être en cours
  // de restauration au même moment après un build/redémarrage. Dans ce cas,
  // on conserve les données et on attend que la source de vérité soit chargée.
  const [activeReferences, allDrafts] = await Promise.all([
    prisma.stockmanCatalogReference.findMany({
      where: { isActive: true },
      select: { reference: true },
    }),
    prisma.stockmanImportDraft.findMany({
      orderBy: [{ status: "asc" }, { preparedAt: "desc" }],
    }),
  ]);

  const activeReferenceSet = new Set(activeReferences.map((item) => item.reference.trim().toUpperCase()));
  const referenceReady = activeReferenceSet.size > 0;
  const orphanDrafts = referenceReady
    ? allDrafts.filter(
        (draft) => draft.status === "PREPARED" && !activeReferenceSet.has(draft.reference.trim().toUpperCase()),
      )
    : [];
  const orphanIds = new Set(orphanDrafts.map((draft) => draft.id));

  // Les brouillons orphelins sont seulement masqués du lot importable.
  // Ils restent en base pour permettre un diagnostic/rétablissement sans perte.
  const drafts = referenceReady ? allDrafts.filter((draft) => !orphanIds.has(draft.id)) : allDrafts;

  const references = drafts.map((draft) => draft.reference);
  const products = references.length
    ? await prisma.product.findMany({
        where: {
          OR: [
            { supplierCode: { in: references } },
            { code: { in: references } },
          ],
        },
        select: { id: true, code: true, supplierCode: true, name: true, publicationStatus: true },
      })
    : [];

  const productByReference = new Map<string, (typeof products)[number]>();
  for (const product of products) {
    if (product.supplierCode) productByReference.set(product.supplierCode.trim().toUpperCase(), product);
    productByReference.set(product.code.trim().toUpperCase(), product);
  }

  return NextResponse.json({
    cleanup: {
      mode: "safe_filter_only",
      referenceReady,
      removed: 0,
      excluded: orphanDrafts.length,
      references: orphanDrafts.map((draft) => draft.reference),
      message: referenceReady
        ? `${orphanDrafts.length} brouillon(s) hors référentiel actif masqué(s), aucune suppression en base.`
        : "Référentiel STOCKMAN non chargé : aucun nettoyage ni masquage destructif n’a été exécuté.",
    },
    drafts: drafts.map((draft) => {
      const product = productByReference.get(draft.reference.trim().toUpperCase());
      return {
        id: draft.id,
        reference: draft.reference,
        designation: draft.designation,
        category: draft.category,
        sourceUrl: draft.sourceUrl,
        purchasePriceExVat: draft.purchasePriceExVat === null ? null : Number(draft.purchasePriceExVat),
        stock: draft.stock,
        stockLabel: draft.stock === null ? "Nous consulter" : String(draft.stock),
        weightKg: draft.weightKg === null ? null : Number(draft.weightKg),
        status: draft.status,
        sourceReadAt: draft.sourceReadAt?.toISOString() ?? null,
        preparedAt: draft.preparedAt.toISOString(),
        product: product
          ? {
              id: product.id,
              code: product.code,
              name: product.name,
              publicationStatus: product.publicationStatus,
            }
          : null,
      };
    }),
  });
}


type ImportResultStatus = "complete" | "partial" | "existing" | "error";

type ImportResult = {
  draftId: string;
  reference?: string;
  productId?: string;
  status: ImportResultStatus;
  completeness?: number;
  missing?: string[];
  message?: string;
};

function enrichmentAssessment(
  live: StockmanProduct | undefined,
  categoryId: string | null,
) {
  const checks = [
    { label: "catégorie", ok: Boolean(categoryId) },
    { label: "description courte", ok: Boolean(live?.shortDescription?.trim()) },
    { label: "description détaillée", ok: Boolean(live?.detailedDescription?.trim()) },
    { label: "image principale", ok: Boolean(live?.images?.length) },
    { label: "document technique", ok: Boolean(live?.documents?.length) },
    { label: "caractéristiques", ok: Boolean(live?.features?.length) },
    { label: "SEO", ok: Boolean(live) },
  ];

  const completed = checks.filter((check) => check.ok).length;
  const missing = checks.filter((check) => !check.ok).map((check) => check.label);
  return {
    completeness: Math.round((completed / checks.length) * 100),
    missing,
    status: missing.length === 0 ? "complete" as const : "partial" as const,
  };
}

export async function POST(request: Request) {
  const denied = await authorize(true);
  if (denied) return denied;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Sélection de brouillons invalide." }, { status: 400 });
  }

  const drafts = await prisma.stockmanImportDraft.findMany({
    where: { id: { in: parsed.data.draftIds } },
  });
  const byId = new Map(drafts.map((draft) => [draft.id, draft]));
  const supplierId = await stockmanSupplierId();

  // V2.9.1 : relire les fiches au moment de la création afin que le brouillon
  // OYSTE soit enrichi (descriptions, médias, documents et caractéristiques),
  // tout en conservant les sécurités V2.9.
  const preparedDrafts = parsed.data.draftIds
    .map((id) => byId.get(id))
    .filter((draft): draft is (typeof drafts)[number] => Boolean(draft && draft.status === "PREPARED"));

  // V2.12.8.4.1 — sécurité d’écriture : même si un ancien brouillon existe
  // encore en base, on refuse de créer un produit si sa référence n’est plus
  // active dans le référentiel STOCKMAN. Si le référentiel est indisponible,
  // on bloque l’import au lieu de supposer que tout est valide.
  const activeReferences = await prisma.stockmanCatalogReference.findMany({
    where: { isActive: true },
    select: { reference: true },
  });
  if (!activeReferences.length) {
    return NextResponse.json(
      { message: "Référentiel STOCKMAN persistant indisponible : création bloquée par sécurité. Rechargez l’audit persistant puis réessayez." },
      { status: 409 },
    );
  }
  const activeReferenceSet = new Set(activeReferences.map((item) => item.reference.trim().toUpperCase()));
  const inactiveSelected = preparedDrafts.filter((draft) => !activeReferenceSet.has(draft.reference.trim().toUpperCase()));
  if (inactiveSelected.length) {
    return NextResponse.json(
      {
        message: `Création bloquée : ${inactiveSelected.length} brouillon(s) ne font plus partie du référentiel STOCKMAN actif.`,
        inactiveReferences: inactiveSelected.map((draft) => draft.reference),
      },
      { status: 409 },
    );
  }
  const liveReads = preparedDrafts.length
    ? await getStockmanProducts(preparedDrafts.map((draft) => ({ reference: draft.reference, productUrl: draft.sourceUrl })))
    : [];
  const liveByReference = new Map<string, StockmanProduct>();
  preparedDrafts.forEach((draft, index) => {
    const product = liveReads[index]?.product;
    if (product) liveByReference.set(draft.reference.trim().toUpperCase(), product);
  });

  let created = 0;
  const results: ImportResult[] = [];

  for (const draftId of parsed.data.draftIds) {
    const draft = byId.get(draftId);
    if (!draft) {
      results.push({ draftId, status: "error", message: "Brouillon introuvable." });
      continue;
    }

    if (draft.status !== "PREPARED") {
      results.push({
        draftId,
        reference: draft.reference,
        status: "existing",
        message: `Brouillon déjà traité (${draft.status}).`,
      });
      continue;
    }

    const existing = await prisma.product.findFirst({
      where: {
        OR: [
          { supplierCode: { equals: draft.reference, mode: "insensitive" } },
          { code: { equals: draft.reference, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.stockmanImportDraft.update({
        where: { id: draft.id },
        data: { status: "IMPORTED" },
      });
      results.push({
        draftId,
        reference: draft.reference,
        productId: existing.id,
        status: "existing",
        completeness: 100,
        missing: [],
        message: "Produit déjà présent dans OYSTE.",
      });
      continue;
    }

    try {
      const live = liveByReference.get(draft.reference.trim().toUpperCase());
      const categoryResolution = await resolveStockmanCategory({
        sourceUrl: live?.sourceUrl || draft.sourceUrl,
        designation: live?.designation || draft.designation,
        categoryHint: draft.category,
      });
      const categoryId = categoryResolution?.id ?? null;
      const importedWeightKg =
        draft.weightKg !== null && Number(draft.weightKg) > 0
          ? Number(draft.weightKg)
          : null;
      const slug = await uniqueSlug(`${draft.designation}-${draft.reference}`);
      const shortDescription = live?.shortDescription?.trim() || null;
      const detailedDescription = live?.detailedDescription?.trim() || null;
      const generatedSeo = buildStockmanSeo(live ?? {
        reference: draft.reference,
        designation: draft.designation,
        sourceUrl: draft.sourceUrl,
        purchasePriceExVat: draft.purchasePriceExVat === null ? 0 : Number(draft.purchasePriceExVat),
        stock: draft.stock ?? 0,
        weightKg: draft.weightKg === null ? null : Number(draft.weightKg),
        readAt: new Date().toISOString(),
        shortDescription: null,
        detailedDescription: null,
        images: [],
        documents: [],
        features: [],
      });
      const seoTitle = generatedSeo.seoTitle;
      const seoDescription = generatedSeo.seoDescription;
      const assessment = enrichmentAssessment(live, categoryId);

      const sourceData: Prisma.InputJsonValue = {
        stockman: {
          reference: draft.reference,
          designation: draft.designation,
          sourceUrl: draft.sourceUrl,
          purchasePriceExVat: draft.purchasePriceExVat === null ? null : Number(draft.purchasePriceExVat),
          purchasePriceUnavailable: draft.purchasePriceExVat === null || Number(draft.purchasePriceExVat) <= 0,
          stock: draft.stock,
          stockLabel: draft.stock === null ? "Nous consulter" : String(draft.stock),
          weightKg: draft.weightKg === null ? null : Number(draft.weightKg),
          sourceReadAt: draft.sourceReadAt?.toISOString() ?? null,
          importedFromDraftAt: new Date().toISOString(),
          category: categoryResolution ? {
            id: categoryResolution.id,
            slug: categoryResolution.slug,
            name: categoryResolution.name,
            reason: categoryResolution.reason,
          } : null,
          enrichment: live ? {
            images: live.images?.length ?? 0,
            documents: live.documents?.length ?? 0,
            features: live.features?.length ?? 0,
            hasShortDescription: Boolean(shortDescription),
            hasDetailedDescription: Boolean(detailedDescription),
          } : null,
        },
      };

      const product = await prisma.$transaction(async (tx) => {
        const createdProduct = await tx.product.create({
          data: {
            id: randomUUID(),
            code: draft.reference,
            supplierCode: draft.reference,
            slug,
            name: draft.designation,
            shortName: draft.designation,
            description: shortDescription,
            detailedDescription,

            // V2.12.7 — règle commerciale STOCKMAN validée : marge de 20 %
            // sur prix de vente, soit PV HT = PA HT / 0,80.
            // Si STOCKMAN ne fournit pas de PA exploitable, le produit reste à 0 :
            // ce 0 est un état technique « Nous consulter », jamais un prix vendable.
            priceHt: draft.purchasePriceExVat !== null && Number(draft.purchasePriceExVat) > 0
              ? Math.round((Number(draft.purchasePriceExVat) / 0.8) * 100) / 100
              : 0,
            stock: draft.stock ?? 0,
            weightKg: importedWeightKg,
            shippingMode: "INCLUDED",
            leadTime: "Départ usine sous 48 h si stock disponible — délai de départ usine, et non délai de livraison.",
            publicationStatus: "DRAFT",
            supplierId,
            categoryId,
            seoTitle,
            seoDescription,
            sourceData,
            media: live?.images?.length ? {
              create: live.images.map((image, index) => ({
                type: "IMAGE",
                url: image.url,
                sourceUrl: image.url,
                altText: image.altText || draft.designation,
                isPrimary: index === 0,
                sortOrder: index,
              })),
            } : undefined,
            documents: live?.documents?.length ? {
              create: live.documents.map((document, index) => ({
                name: document.name,
                type: document.type,
                url: document.url,
                sourceUrl: document.url,
                isPublic: true,
                sortOrder: index,
              })),
            } : undefined,
            features: live?.features?.length ? {
              create: live.features.map((feature, index) => ({
                label: feature.label,
                value: feature.value,
                sortOrder: index,
              })),
            } : undefined,
          },
          select: { id: true },
        });

        await tx.stockmanImportDraft.update({
          where: { id: draft.id },
          data: { status: "IMPORTED" },
        });

        return createdProduct;
      });

      created += 1;
      results.push({
        draftId,
        reference: draft.reference,
        productId: product.id,
        status: assessment.status,
        completeness: assessment.completeness,
        missing: assessment.missing,
        message: assessment.status === "complete"
          ? "Créé et enrichi automatiquement."
          : `Créé avec ${assessment.missing.length} élément(s) à compléter.`,
      });
    } catch (error) {
      results.push({
        draftId,
        reference: draft.reference,
        status: "error",
        message: error instanceof Error ? error.message : "Création du produit impossible.",
      });
    }
  }

  const complete = results.filter((result) => result.status === "complete").length;
  const partial = results.filter((result) => result.status === "partial").length;
  const existing = results.filter((result) => result.status === "existing").length;
  const errors = results.filter((result) => result.status === "error").length;

  return NextResponse.json({
    created,
    requested: parsed.data.draftIds.length,
    summary: { complete, partial, existing, errors },
    results,
    message: `${created} produit(s) traité(s) en brouillon OYSTE · ${complete} complet(s) · ${partial} partiel(s) · ${existing} déjà présent(s) · ${errors} erreur(s). Aucun produit n’a été publié automatiquement.`,
  });
}
