import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentAdmin } from "@/lib/auth/admin-session";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  if (admin.role === "READ_ONLY") {
    return NextResponse.json({ error: "Votre rôle ne permet pas de supprimer une catégorie." }, { status: 403 });
  }

  const { id } = await params;
  const category = await prisma.category.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      path: true,
      _count: { select: { products: true, children: true } },
    },
  });

  if (!category) return NextResponse.json({ error: "Catégorie introuvable." }, { status: 404 });

  if (category._count.products > 0 || category._count.children > 0) {
    return NextResponse.json(
      {
        error: `Suppression refusée : ${category._count.products} produit(s) et ${category._count.children} sous-catégorie(s) sont encore rattachés à cette catégorie.`,
        productCount: category._count.products,
        childCount: category._count.children,
      },
      { status: 409 },
    );
  }

  await prisma.category.delete({ where: { id: category.id } });
  return NextResponse.json({ deleted: true, id: category.id, name: category.name, path: category.path });
}
