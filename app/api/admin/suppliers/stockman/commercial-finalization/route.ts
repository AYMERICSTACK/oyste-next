import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentAdmin } from "@/lib/auth/admin-session";

const STOCKMAN_LEAD_TIME = "Départ usine sous 48 h si stock disponible — délai de départ usine, et non délai de livraison.";

export async function POST() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const supplier = await prisma.supplier.findFirst({
    where: { name: { equals: "STOCKMAN", mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (!supplier) return NextResponse.json({ error: "Fournisseur STOCKMAN introuvable." }, { status: 404 });

  const products = await prisma.product.findMany({
    where: { supplierId: supplier.id },
    select: { id: true, stock: true, variants: { select: { id: true, stock: true } } },
  });

  const productIds = products.map((product) => product.id);
  const variantIds = products.flatMap((product) => product.variants.map((variant) => variant.id));

  const [productsUpdated, variantsUpdated] = await prisma.$transaction([
    prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: { shippingMode: "INCLUDED", leadTime: STOCKMAN_LEAD_TIME },
    }),
    prisma.productVariant.updateMany({
      where: { id: { in: variantIds } },
      data: { shippingMode: "INCLUDED", leadTime: STOCKMAN_LEAD_TIME },
    }),
  ]);

  return NextResponse.json({
    version: "V2.11.2",
    supplier: supplier.name,
    productsUpdated: productsUpdated.count,
    variantsUpdated: variantsUpdated.count,
    shippingMode: "INCLUDED",
    leadTime: STOCKMAN_LEAD_TIME,
    message: `${productsUpdated.count} produit(s) et ${variantsUpdated.count} variante(s) STOCKMAN finalisés : livraison incluse + départ usine sous 48 h si stock disponible.`,
  });
}
