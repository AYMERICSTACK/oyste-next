import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentAdmin } from "@/lib/auth/admin-session";

const shippingModeSchema = z.enum(["INCLUDED", "MESSAGERIE", "AFFRETEMENT", "QUOTE"]);

const updateShippingSchema = z.object({
  weightKg: z.number().finite().nonnegative().nullable(),
  packageLengthCm: z.number().finite().nonnegative().nullable(),
  packageWidthCm: z.number().finite().nonnegative().nullable(),
  packageHeightCm: z.number().finite().nonnegative().nullable(),
  shippingMode: shippingModeSchema,
  leadTime: z.string().max(500).nullable().optional(),
  publicationStatus: z.enum(["PUBLISHED", "DRAFT", "HIDDEN"]),
  variants: z.array(z.object({
    id: z.string().min(1),
    weightKg: z.number().finite().nonnegative().nullable(),
    packageLengthCm: z.number().finite().nonnegative().nullable(),
    packageWidthCm: z.number().finite().nonnegative().nullable(),
    packageHeightCm: z.number().finite().nonnegative().nullable(),
    shippingMode: shippingModeSchema.nullable(),
  })).default([]),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = updateShippingSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Données de livraison invalides." }, { status: 400 });
  }

  const { weightKg, packageLengthCm, packageWidthCm, packageHeightCm, shippingMode, leadTime, publicationStatus, variants } = parsed.data;
  const normalizedWeightKg = weightKg !== null && weightKg > 0 ? weightKg : null;
  const normalizeDimension = (value: number | null) => value !== null && value > 0 ? value : null;
  const normalizedPackageLengthCm = normalizeDimension(packageLengthCm);
  const normalizedPackageWidthCm = normalizeDimension(packageWidthCm);
  const normalizedPackageHeightCm = normalizeDimension(packageHeightCm);
  const normalizedVariants = variants.map((variant) => ({
    ...variant,
    packageLengthCm: normalizeDimension(variant.packageLengthCm),
    packageWidthCm: normalizeDimension(variant.packageWidthCm),
    packageHeightCm: normalizeDimension(variant.packageHeightCm),
    weightKg:
      variant.weightKg !== null && variant.weightKg > 0
        ? variant.weightKg
        : null,
  }));

  const productDimensions = [normalizedPackageLengthCm, normalizedPackageWidthCm, normalizedPackageHeightCm];
  if (productDimensions.some((value) => value !== null) && productDimensions.some((value) => value === null)) {
    return NextResponse.json({ error: "Renseignez les 3 dimensions du colis produit, ou laissez-les toutes vides." }, { status: 400 });
  }

  if (normalizedVariants.some((variant) => {
    const dimensions = [variant.packageLengthCm, variant.packageWidthCm, variant.packageHeightCm];
    return dimensions.some((value) => value !== null) && dimensions.some((value) => value === null);
  })) {
    return NextResponse.json({ error: "Une variante doit avoir ses 3 dimensions de colis, ou hériter entièrement du produit." }, { status: 400 });
  }

  if (shippingMode === "MESSAGERIE" && normalizedWeightKg === null) {
    return NextResponse.json({ error: "Le poids est obligatoire pour une expédition en messagerie." }, { status: 400 });
  }

  if (normalizedVariants.some((variant) => variant.shippingMode === "MESSAGERIE" && variant.weightKg === null && normalizedWeightKg === null)) {
    return NextResponse.json({ error: "Une variante en messagerie doit avoir un poids propre ou hériter du poids produit." }, { status: 400 });
  }

  const existing = await prisma.product.findUnique({
    where: { id },
    select: { id: true, variants: { select: { id: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });

  const validVariantIds = new Set(existing.variants.map((variant) => variant.id));
  if (normalizedVariants.some((variant) => !validVariantIds.has(variant.id))) {
    return NextResponse.json({ error: "Une variante ne correspond pas à ce produit." }, { status: 400 });
  }

  const product = await prisma.$transaction(async (tx) => {
    const updatedProduct = await tx.product.update({
      where: { id },
      data: {
        weightKg: normalizedWeightKg,
        packageLengthCm: normalizedPackageLengthCm,
        packageWidthCm: normalizedPackageWidthCm,
        packageHeightCm: normalizedPackageHeightCm,
        shippingMode,
        leadTime: leadTime?.trim() || null,
        publicationStatus,
        publishedAt: publicationStatus === "PUBLISHED" ? new Date() : null,
      },
      select: { id: true, weightKg: true, shippingMode: true, publicationStatus: true, updatedAt: true },
    });

    for (const variant of normalizedVariants) {
      await tx.productVariant.update({
        where: { id: variant.id },
        data: {
          weightKg: variant.weightKg,
          packageLengthCm: variant.packageLengthCm,
          packageWidthCm: variant.packageWidthCm,
          packageHeightCm: variant.packageHeightCm,
          shippingMode: variant.shippingMode,
        },
      });
    }

    return updatedProduct;
  });

  return NextResponse.json({
    product: { ...product, weightKg: product.weightKg === null ? null : Number(product.weightKg) },
  });
}


export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  if (admin.role === "READ_ONLY") {
    return NextResponse.json({ error: "Votre rôle ne permet pas de supprimer un produit." }, { status: 403 });
  }

  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      name: true,
      _count: { select: { orderItems: true } },
    },
  });

  if (!product) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });

  if (product._count.orderItems > 0) {
    return NextResponse.json(
      {
        error: `Suppression refusée : ${product._count.orderItems} ligne(s) de commande référencent ce produit. Masquez-le plutôt pour préserver l’historique commercial.`,
        blockingOrderItems: product._count.orderItems,
      },
      { status: 409 },
    );
  }

  await prisma.product.delete({ where: { id: product.id } });

  return NextResponse.json({
    deleted: true,
    id: product.id,
    code: product.code,
    name: product.name,
  });
}
