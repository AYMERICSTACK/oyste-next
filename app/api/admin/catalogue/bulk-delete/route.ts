import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentAdmin } from "@/lib/auth/admin-session";

export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  if (admin.role === "READ_ONLY") {
    return NextResponse.json({ error: "Votre rôle ne permet pas de supprimer des produits." }, { status: 403 });
  }

  const body: unknown = await request.json().catch(() => ({}));
  const rawIds: unknown[] =
    body && typeof body === "object" && "ids" in body && Array.isArray((body as { ids?: unknown }).ids)
      ? ((body as { ids: unknown[] }).ids)
      : [];
  const ids: string[] = Array.from(
    new Set(
      rawIds
        .filter((id): id is string => typeof id === "string")
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    ),
  );

  if (!ids.length) {
    return NextResponse.json({ error: "Aucun produit sélectionné." }, { status: 400 });
  }
  if (ids.length > 200) {
    return NextResponse.json({ error: "La suppression est limitée à 200 produits à la fois." }, { status: 400 });
  }

  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      code: true,
      name: true,
      _count: { select: { orderItems: true } },
    },
  });

  if (products.length !== ids.length) {
    return NextResponse.json(
      { error: "La sélection a changé : au moins un produit n’existe plus. Actualisez le catalogue." },
      { status: 409 },
    );
  }

  const blocked = products
    .filter((product) => product._count.orderItems > 0)
    .map((product) => ({
      id: product.id,
      code: product.code,
      name: product.name,
      orderItems: product._count.orderItems,
    }));

  if (blocked.length) {
    return NextResponse.json(
      {
        error: `Suppression annulée : ${blocked.length} produit(s) apparaissent déjà dans une commande. Aucun produit n’a été supprimé.`,
        blocked,
      },
      { status: 409 },
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const deleted = await tx.product.deleteMany({ where: { id: { in: ids } } });
    if (deleted.count !== ids.length) {
      throw new Error("BULK_DELETE_COUNT_MISMATCH");
    }
    return deleted.count;
  });

  return NextResponse.json({
    deleted: result,
    products: products.map(({ id, code, name }) => ({ id, code, name })),
  });
}
