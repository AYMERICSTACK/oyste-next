import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const executeSchema = z.object({
  action: z.literal("execute"),
  confirmation: z.literal("REBUILD STOCKMAN"),
});

async function authorize(write = false) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== "ACTIVE") {
    return { denied: NextResponse.json({ message: "Non autorisé." }, { status: 401 }), admin: null };
  }
  if (write && admin.role === "READ_ONLY") {
    return { denied: NextResponse.json({ message: "Votre rôle ne permet pas de reconstruire le catalogue." }, { status: 403 }), admin };
  }
  return { denied: null, admin };
}

async function getSupplier() {
  return prisma.supplier.findFirst({
    where: { OR: [
      { name: { equals: "STOCKMAN", mode: "insensitive" } },
      { slug: { equals: "stockman", mode: "insensitive" } },
    ] },
    select: { id: true, name: true },
  });
}

async function preflight() {
  const supplier = await getSupplier();
  if (!supplier) throw new Error("Fournisseur STOCKMAN introuvable.");

  const products = await prisma.product.findMany({
    where: { supplierId: supplier.id },
    select: {
      id: true,
      variants: { select: { id: true } },
      _count: { select: { media: true, documents: true, features: true, orderItems: true } },
    },
  });
  const variantIds = products.flatMap((p) => p.variants.map((v) => v.id));
  const variantOrderItems = variantIds.length
    ? await prisma.orderItem.count({ where: { variantId: { in: variantIds } } })
    : 0;
  const [activeLivingReferences, totalLivingReferences, drafts] = await Promise.all([
    prisma.stockmanCatalogReference.count({ where: { isActive: true } }),
    prisma.stockmanCatalogReference.count(),
    prisma.stockmanImportDraft.count(),
  ]);

  return {
    supplier,
    summary: {
      products: products.length,
      variants: variantIds.length,
      media: products.reduce((n, p) => n + p._count.media, 0),
      documents: products.reduce((n, p) => n + p._count.documents, 0),
      features: products.reduce((n, p) => n + p._count.features, 0),
      historicalOrderItems: products.reduce((n, p) => n + p._count.orderItems, 0) + variantOrderItems,
      activeLivingReferences,
      totalLivingReferences,
      drafts,
    },
  };
}

export async function GET() {
  const { denied } = await authorize(false);
  if (denied) return denied;
  try {
    const report = await preflight();
    return NextResponse.json({
      mode: "preflight",
      ...report.summary,
      protections: [
        "Suppression limitée aux produits supplierId = STOCKMAN.",
        "Commandes historiques conservées grâce aux relations onDelete:SetNull.",
        "Référentiel vivant Stockman conservé puis désassocié du catalogue courant.",
        "Brouillons Stockman vidés pour repartir proprement.",
        "Aucun autre fournisseur touché.",
      ],
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Préflight impossible." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { denied } = await authorize(true);
  if (denied) return denied;
  const parsed = executeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: 'Saisissez exactement "REBUILD STOCKMAN".' }, { status: 400 });
  }

  try {
    const before = await preflight();
    await prisma.$transaction(async (tx) => {
      await tx.stockmanCatalogReference.updateMany({
        data: {
          targetType: null, targetId: null, productId: null, targetReference: null,
          lastMatchStatus: null, lastMatchMethod: null, lastConfidence: null, lastMissingKind: null,
        },
      });
      await tx.stockmanImportDraft.deleteMany();
      await tx.product.deleteMany({ where: { supplierId: before.supplier.id } });
    });

    return NextResponse.json({
      success: true,
      removedProducts: before.summary.products,
      removedVariants: before.summary.variants,
      preservedHistoricalOrderItems: before.summary.historicalOrderItems,
      activeLivingReferencesPreserved: before.summary.activeLivingReferences,
      message: `Catalogue STOCKMAN réinitialisé : ${before.summary.products} produit(s), ${before.summary.variants} variante(s). ${before.summary.activeLivingReferences} référence(s) vivante(s) conservée(s). V2.10.18.0 peut maintenant reconstruire directement depuis l'intranet, sans Excel et sans rescan obligatoire.`,
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Clean rebuild impossible." }, { status: 500 });
  }
}
