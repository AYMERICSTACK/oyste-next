import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentAdmin } from "@/lib/auth/admin-session";

const TARGETS: Array<{ codes: string[]; path: string }> = [
  {
    codes: ["HBGK"],
    path: "Manutention au sol\\Grue d'atelier\\Grue d'atelier électrique",
  },
  {
    codes: ["HBFAPO"],
    path: "Manutention au sol\\Grue d'atelier\\Grue d'atelier longerons parallèle",
  },
  {
    codes: ["HBGKFAPO", "HBGSFAPO", "ITI500", "HB300GKNF8"],
    path: "Manutention au sol\\Grue d'atelier\\Grue d'atelier porte à faux",
  },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function ensureCategoryPath(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  requestedPath: string,
) {
  const parts = requestedPath.split("\\").map((part) => part.trim()).filter(Boolean);
  let parentId: string | null = null;
  let currentPath = "";
  let finalId = "";

  for (const name of parts) {
    currentPath = currentPath ? `${currentPath}\\${name}` : name;

    const existing: { id: string; path: string | null } | null =
      await tx.category.findFirst({
        where: {
          OR: [
            { path: currentPath },
            { AND: [{ name }, { parentId }] },
          ],
        },
        select: { id: true, path: true },
      });

    if (existing) {
      finalId = existing.id;
      parentId = existing.id;
      if (!existing.path) {
        await tx.category.update({
          where: { id: existing.id },
          data: { path: currentPath },
        });
      }
      continue;
    }

    let slug = slugify(currentPath);
    let suffix = 2;
    while (await tx.category.findUnique({ where: { slug }, select: { id: true } })) {
      slug = `${slugify(currentPath)}-${suffix++}`;
    }

    const created: { id: string } = await tx.category.create({
      data: {
        name,
        slug,
        path: currentPath,
        parentId,
        isActive: true,
      },
      select: { id: true },
    });

    finalId = created.id;
    parentId = created.id;
  }

  if (!finalId) throw new Error(`Catégorie cible impossible à résoudre : ${requestedPath}`);
  return finalId;
}

export async function POST() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  if (admin.role === "READ_ONLY") {
    return NextResponse.json({ error: "Votre rôle ne permet pas de corriger les catégories." }, { status: 403 });
  }

  const codes = TARGETS.flatMap((target) => target.codes);
  const products = await prisma.product.findMany({
    where: { code: { in: codes } },
    select: {
      id: true,
      code: true,
      name: true,
      category: { select: { path: true, name: true } },
    },
  });

  const byCode = new Map(products.map((product) => [product.code.toUpperCase(), product]));

  const result = await prisma.$transaction(async (tx) => {
    const changes: Array<{
      code: string;
      name: string;
      from: string;
      to: string;
    }> = [];
    const missing: string[] = [];

    for (const target of TARGETS) {
      const categoryId = await ensureCategoryPath(tx, target.path);

      for (const code of target.codes) {
        const product = byCode.get(code.toUpperCase());
        if (!product) {
          missing.push(code);
          continue;
        }

        const from = product.category?.path || product.category?.name || "Aucune catégorie";
        if (from === target.path) continue;

        await tx.product.update({
          where: { id: product.id },
          data: { categoryId },
        });

        changes.push({
          code: product.code,
          name: product.name,
          from,
          to: target.path,
        });
      }
    }

    return { changes, missing };
  }, {
    maxWait: 10_000,
    timeout: 30_000,
  });

  return NextResponse.json({
    version: "V2.10.23.2",
    updated: result.changes.length,
    changes: result.changes,
    missing: result.missing,
  });
}
