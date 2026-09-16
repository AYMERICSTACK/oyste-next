import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentAdmin } from "@/lib/auth/admin-session";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  if (admin.role === "READ_ONLY") {
    return NextResponse.json({ error: "Votre rôle ne permet pas de supprimer un fournisseur." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const expectedName = typeof body?.name === "string" ? body.name.trim() : "";

  const supplier = await prisma.supplier.findFirst({
    where: {
      OR: [
        { id },
        { slug: { equals: id, mode: "insensitive" } },
        ...(expectedName ? [{ name: { equals: expectedName, mode: "insensitive" as const } }] : []),
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: { select: { products: true } },
    },
  });

  if (!supplier) return NextResponse.json({ error: "Fournisseur introuvable." }, { status: 404 });

  if (expectedName && supplier.name !== expectedName) {
    return NextResponse.json({ error: "Le fournisseur a changé depuis l’ouverture de la fiche." }, { status: 409 });
  }

  if (supplier._count.products > 0) {
    return NextResponse.json(
      {
        error: `Suppression refusée : ${supplier._count.products} produit(s) sont encore associés à ${supplier.name}.`,
        productCount: supplier._count.products,
      },
      { status: 409 },
    );
  }

  await prisma.supplier.delete({ where: { id: supplier.id } });

  return NextResponse.json({ deleted: true, id: supplier.id, name: supplier.name });
}
