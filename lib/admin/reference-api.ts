import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { canWriteCatalogue } from "./catalogue-permissions";
import { categoryInputSchema, supplierInputSchema, isIntegrationSupplier } from "./reference-validation";

type Kind = "category" | "supplier";
export async function listReferences(kind: Kind) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const items = kind === "category"
    ? await prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] })
    : await prisma.supplier.findMany({ orderBy: { name: "asc" } });
  const products = kind === "category" ? await prisma.product.findMany({ select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }) : [];
  return NextResponse.json({ items, products, writable: canWriteCatalogue(admin) });
}
export async function saveReference(kind: Kind, request: Request, id?: string) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  if (!canWriteCatalogue(admin)) return NextResponse.json({ error: "Votre rôle ne permet pas de modifier le catalogue." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const parsed = (kind === "category" ? categoryInputSchema : supplierInputSchema).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Vérifiez les champs obligatoires, les liens et les nombres.", fields: parsed.error.flatten() }, { status: 400 });
  try {
    const item = await prisma.$transaction(async tx => {
      // Serializing reference edits also prevents simultaneous parent edits from creating a cycle.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(728194062)`;
      const existing = id ? (kind === "category" ? await tx.category.findUnique({ where: { id } }) : await tx.supplier.findUnique({ where: { id } })) : null;
      if (id && !existing) throw new Error("NOT_FOUND");
      if (existing && existing.slug !== parsed.data.slug) throw new Error("SLUG_LOCKED");
      let saved;
      if (kind === "category") {
        const data = categoryInputSchema.parse(body);
        let ancestorId = data.parentId;
        const visited = new Set<string>();
        while (ancestorId) {
          if (ancestorId === id || visited.has(ancestorId)) throw new Error("CYCLE");
          visited.add(ancestorId);
          const ancestor = await tx.category.findUnique({ where: { id: ancestorId }, select: { parentId: true } });
          if (!ancestor) throw new Error("PARENT");
          ancestorId = ancestor.parentId;
        }
        let homeAncestorId = data.homeParentId;
        const homeVisited = new Set<string>();
        while (homeAncestorId) {
          if (homeAncestorId === id || homeVisited.has(homeAncestorId)) throw new Error("CYCLE");
          homeVisited.add(homeAncestorId);
          const ancestor = await tx.category.findUnique({ where: { id: homeAncestorId }, select: { homeParentId: true } });
          if (!ancestor) throw new Error("PARENT");
          homeAncestorId = ancestor.homeParentId;
        }
        if (data.representativeProductId && !(await tx.product.findUnique({ where: { id: data.representativeProductId } }))) throw new Error("PRODUCT");
        const configuredData = { ...data, presentationConfigured: true };
        saved = id ? await tx.category.update({ where: { id }, data: configuredData }) : await tx.category.create({ data: configuredData });
      } else {
        const data = supplierInputSchema.parse(body);
        if (existing && isIntegrationSupplier(existing) && existing.name !== data.name) throw new Error("INTEGRATION_NAME");
        saved = id ? await tx.supplier.update({ where: { id }, data: { ...data, presentationConfigured: true } }) : await tx.supplier.create({ data: { ...data, presentationConfigured: true } });
      }
      await tx.auditLog.create({ data: { action: id ? "REFERENCE_UPDATE" : "REFERENCE_CREATE", entityType: kind, entityId: saved.id, userId: admin.id, metadata: { fields: Object.keys(parsed.data) } } });
      return saved;
    });
    return NextResponse.json({ item }, { status: id ? 200 : 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Ce nom ou cette adresse publique existe déjà." }, { status: 409 });
    const message = error instanceof Error ? error.message : "";
    const errors: Record<string, string> = { NOT_FOUND: "Fiche introuvable.", SLUG_LOCKED: "L’adresse publique existante est conservée pour préserver les liens du site.", CYCLE: "Ce parent créerait une boucle dans les catégories.", PRODUCT: "Le produit représentatif est introuvable.", PARENT: "La catégorie parente est introuvable.", INTEGRATION_NAME: "Le nom de ce fournisseur est réservé à une intégration." };
    if (errors[message]) return NextResponse.json({ error: errors[message] }, { status: message === "NOT_FOUND" ? 404 : 400 });
    return NextResponse.json({ error: "Enregistrement impossible. Réessayez." }, { status: 500 });
  }
}

export async function deleteReference(kind: Kind, request: Request, id: string) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  if (!canWriteCatalogue(admin)) return NextResponse.json({ error: "Votre rôle ne permet pas de supprimer cette fiche." }, { status: 403 });
  try {
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(728194062)`;
      if (kind === "category") {
        const item = await tx.category.findUnique({ where: { id }, include: { _count: { select: { products: true, children: true, homeChildren: true } } } });
        if (!item) throw new Error("NOT_FOUND");
        if (item._count.products || item._count.children || item._count.homeChildren) throw new Error("LINKED");
        await tx.category.delete({ where: { id } });
      } else {
        const item = await tx.supplier.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });
        if (!item) throw new Error("NOT_FOUND");
        if (item._count.products) throw new Error("LINKED");
        // Integration identities remain stable even if their catalogue is temporarily empty.
        if (isIntegrationSupplier(item)) throw new Error("INTEGRATION");
        await tx.supplier.delete({ where: { id } });
      }
      await tx.auditLog.create({ data: { action: "REFERENCE_DELETE", entityType: kind, entityId: id, userId: admin.id } });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_FOUND") return NextResponse.json({ error: "Fiche introuvable." }, { status: 404 });
    if (message === "LINKED") return NextResponse.json({ error: "Suppression refusée : des produits ou sous-catégories sont liés. Désactivez cette fiche." }, { status: 409 });
    if (message === "INTEGRATION") return NextResponse.json({ error: "Ce fournisseur est réservé à une intégration. Sa suppression est bloquée." }, { status: 409 });
    return NextResponse.json({ error: "Suppression impossible : les données ont pu changer. Rechargez la page." }, { status: 409 });
  }
}
