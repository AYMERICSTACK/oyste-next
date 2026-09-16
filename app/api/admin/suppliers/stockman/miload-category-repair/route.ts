import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentAdmin } from "@/lib/auth/admin-session";

const MILOAD_ACCESSORY_CODES = [
  "MLEVM",
  "MPDM",
  "MPZGF",
  "MPZGSE",
  "MSLH",
  "MVPU",
  "MWN",
  "MWP",
  "MWS",
  "MWSTE",
  "MWSTM",
  "PZG1-MBP",
] as const;

function normalized(value: string | null | undefined) {
  return String(value || "")
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .trim();
}

async function resolveTargetCategory() {
  const categories = await prisma.category.findMany({
    select: { id: true, name: true, path: true, parentId: true },
  });

  const exactAccessory = categories.find((category) => {
    const path = normalized(category.path);
    const name = normalized(category.name);
    return path.includes("manutention au sol") &&
      path.includes("grue d'atelier") &&
      (name.includes("accessoire") || path.includes("accessoire"));
  });
  if (exactAccessory) return exactAccessory;

  const craneRoot = categories.find((category) => {
    const path = normalized(category.path);
    const name = normalized(category.name);
    return (
      path === "manutention au sol\\grue d'atelier" ||
      (name === "grue d'atelier" && path.includes("manutention au sol"))
    );
  });
  return craneRoot || null;
}

async function buildPreview() {
  const supplier = await prisma.supplier.findFirst({
    where: { name: { equals: "STOCKMAN", mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (!supplier) return null;

  const target = await resolveTargetCategory();
  const products = await prisma.product.findMany({
    where: {
      supplierId: supplier.id,
      code: { in: [...MILOAD_ACCESSORY_CODES] },
    },
    select: {
      id: true,
      code: true,
      name: true,
      categoryId: true,
      category: { select: { name: true, path: true } },
    },
    orderBy: { code: "asc" },
  });

  return {
    version: "V2.11.3.2",
    supplier,
    target,
    expected: MILOAD_ACCESSORY_CODES.length,
    found: products.length,
    missingCodes: MILOAD_ACCESSORY_CODES.filter((code) => !products.some((product) => product.code === code)),
    toRepair: products.filter((product) => !product.categoryId).length,
    alreadyCategorized: products.filter((product) => Boolean(product.categoryId)).length,
    products,
  };
}

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== "ACTIVE") {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const preview = await buildPreview();
  if (!preview) return NextResponse.json({ error: "Fournisseur STOCKMAN introuvable." }, { status: 404 });
  if (!preview.target) {
    return NextResponse.json({
      ...preview,
      error: "Catégorie cible Grue d'atelier introuvable : aucune écriture ne sera effectuée.",
    }, { status: 409 });
  }
  return NextResponse.json(preview);
}

export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== "ACTIVE" || admin.role === "READ_ONLY") {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const preview = await buildPreview();
  if (!preview) return NextResponse.json({ error: "Fournisseur STOCKMAN introuvable." }, { status: 404 });
  if (!preview.target) return NextResponse.json({ error: "Catégorie cible Grue d'atelier introuvable." }, { status: 409 });

  const expectedConfirmation = `CLASSER MILOAD ${preview.toRepair}`;
  if (body?.confirmation !== expectedConfirmation) {
    return NextResponse.json({
      error: `Confirmation invalide. Tapez exactement ${expectedConfirmation}.`,
    }, { status: 400 });
  }

  const repairIds = preview.products
    .filter((product) => !product.categoryId)
    .map((product) => product.id);

  const result = repairIds.length
    ? await prisma.product.updateMany({
        where: { id: { in: repairIds }, categoryId: null },
        data: { categoryId: preview.target.id },
      })
    : { count: 0 };

  return NextResponse.json({
    version: "V2.11.3.2",
    repaired: result.count,
    target: preview.target,
    message: `${result.count} accessoire(s) MILOAD classé(s) dans ${preview.target.path || preview.target.name}.`,
  });
}
