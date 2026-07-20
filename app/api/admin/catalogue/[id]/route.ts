import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

const shippingModeSchema = z.enum(["INCLUDED", "MESSAGERIE", "AFFRETEMENT", "QUOTE"]);

const updateShippingSchema = z.object({
  weightKg: z.number().finite().positive().nullable(),
  shippingMode: shippingModeSchema,
  publicationStatus: z.enum(["PUBLISHED", "DRAFT", "HIDDEN"]),
  variants: z.array(z.object({
    id: z.string().min(1),
    weightKg: z.number().finite().positive().nullable(),
    shippingMode: shippingModeSchema.nullable(),
  })).default([]),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = updateShippingSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Données de livraison invalides." }, { status: 400 });
  }

  const { weightKg, shippingMode, publicationStatus, variants } = parsed.data;

  if (shippingMode === "MESSAGERIE" && weightKg === null) {
    return NextResponse.json({ error: "Le poids est obligatoire pour une expédition en messagerie." }, { status: 400 });
  }

  if (variants.some((variant) => variant.shippingMode === "MESSAGERIE" && variant.weightKg === null && weightKg === null)) {
    return NextResponse.json({ error: "Une variante en messagerie doit avoir un poids propre ou hériter du poids produit." }, { status: 400 });
  }

  const existing = await prisma.product.findUnique({
    where: { id },
    select: { id: true, variants: { select: { id: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });

  const validVariantIds = new Set(existing.variants.map((variant) => variant.id));
  if (variants.some((variant) => !validVariantIds.has(variant.id))) {
    return NextResponse.json({ error: "Une variante ne correspond pas à ce produit." }, { status: 400 });
  }

  const product = await prisma.$transaction(async (tx) => {
    const updatedProduct = await tx.product.update({
      where: { id },
      data: {
        weightKg,
        shippingMode,
        publicationStatus,
        publishedAt: publicationStatus === "PUBLISHED" ? new Date() : null,
      },
      select: { id: true, weightKg: true, shippingMode: true, publicationStatus: true, updatedAt: true },
    });

    for (const variant of variants) {
      await tx.productVariant.update({
        where: { id: variant.id },
        data: { weightKg: variant.weightKg, shippingMode: variant.shippingMode },
      });
    }

    return updatedProduct;
  });

  return NextResponse.json({
    product: { ...product, weightKg: product.weightKg === null ? null : Number(product.weightKg) },
  });
}
