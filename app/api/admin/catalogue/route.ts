import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { canWriteCatalogue } from "@/lib/admin/catalogue-permissions";
import { createProductSchema } from "@/lib/admin/product-validation";
export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  if (!canWriteCatalogue(admin)) return NextResponse.json({ error: "Votre rôle ne permet pas de créer un produit." }, { status: 403 });
  const parsed = createProductSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Vérifiez le nom, la référence, l’adresse publique et le prix." }, { status: 400 });
  try {
    const product = await prisma.$transaction(async tx => {
      const { categoryId } = parsed.data;
      if (categoryId && !(await tx.category.findFirst({ where: { id: categoryId, isActive: true } }))) throw new Error("CATEGORY");
      if (await tx.product.findFirst({ where: { code: parsed.data.code } })) throw new Error("CODE");
      const item = await tx.product.create({ data: { ...parsed.data, id: randomUUID(), publicationStatus: "DRAFT", shippingMode: "QUOTE", sourceData: { adminCreated: true } } });
      await tx.auditLog.create({ data: { action: "PRODUCT_CREATE", entityType: "Product", entityId: item.id, userId: admin.id } });
      return item;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ id: product.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "CATEGORY") return NextResponse.json({ error: "Choisissez une catégorie active." }, { status: 400 });
    if (message === "CODE" || (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code))) return NextResponse.json({ error: "Cette référence ou adresse existe déjà, ou une modification simultanée nécessite de réessayer." }, { status: 409 });
    return NextResponse.json({ error: "Création impossible. Réessayez." }, { status: 500 });
  }
}
