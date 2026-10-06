import { isAdminVariant } from "@/lib/admin/variant-validation";
import { isAdminCreated } from "@/lib/admin/product-validation";
import { getDatabaseStockmanFamilyVariants } from "@/lib/catalogue/database-repository";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { canWriteCatalogue } from "@/lib/admin/catalogue-permissions";
import { productPresentationSchema } from "@/lib/catalogue/product-presentation";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id }, include: { presentation: true, media: { where:{type:"IMAGE"}, orderBy: [{isPrimary:"desc"},{sortOrder:"asc"}] }, documents: { orderBy: { sortOrder: "asc" } }, features: { orderBy: { sortOrder: "asc" } }, variants: { orderBy: { code: "asc" } } } });
  if (!product) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
  const overrides = productPresentationSchema.safeParse(product.presentation?.value).data || {};
  const mergeSupplierFamily=product.variants.length>0 && !isAdminCreated(product.sourceData) && product.variants.every(item=>isAdminVariant(item.sourceData));
  const family = product.variants.length && !mergeSupplierFamily ? null : await getDatabaseStockmanFamilyVariants(id);
  const presentationProduct = { ...product, variants: mergeSupplierFamily ? [...(family?.variants.length ? family.variants : [{id:product.id,name:product.name,label:product.name}]),...product.variants] : product.variants.length ? product.variants : family?.variants.length ? family.variants : [{id:product.id,name:product.name,label:product.name}] };
  const categories=await prisma.category.findMany({select:{id:true,name:true,slug:true},orderBy:{name:"asc"}});
  const suppliers=await prisma.supplier.findMany({select:{id:true,name:true},orderBy:{name:"asc"}});
  return NextResponse.json({ product: presentationProduct, adminCreated:isAdminCreated(product.sourceData), suppliers, categories, overrides, writable: canWriteCatalogue(admin) });
}
export async function PUT(request: Request, { params }: Context) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  if (!canWriteCatalogue(admin)) return NextResponse.json({ error: "Votre rôle ne permet pas de modifier le catalogue." }, { status: 403 });
  const parsed = productPresentationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Présentation invalide. Vérifiez les champs et les liens.", fields: parsed.error.flatten() }, { status: 400 });
  const { id } = await params;
  const family = parsed.data.variantPresentation ? await getDatabaseStockmanFamilyVariants(id) : null;
  try {
    const result = await prisma.$transaction(async tx => {
      const existing = await tx.product.findUnique({ where: { id }, include: { variants: { select: { id: true } } } });
      if (!existing) throw new Error("NOT_FOUND");
      if (parsed.data.variantPresentation?.some(item => item.id !== existing.id && !existing.variants.some(variant => variant.id === item.id) && !family?.variants.some(variant=>variant.id===item.id))) throw new Error("VARIANT");
      if(parsed.data.categoryId && !await tx.category.findUnique({where:{id:parsed.data.categoryId}})) throw Error("CATEGORY");
      const codes = [...(parsed.data.relatedProductCodes || []), ...(parsed.data.accessoryProductCodes || [])];
      if (codes.length) {
        const matches = await tx.product.findMany({ where: { code: { in: codes } }, select: { code: true } });
        if (codes.some(code => !matches.some(item => item.code === code))) throw new Error("RELATED");
      }
      const presentation = await tx.productPresentationOverride.upsert({ where: { productId: id }, update: { value: parsed.data }, create: { productId: id, value: parsed.data } });
      await tx.auditLog.create({ data: { action: "PRODUCT_PRESENTATION_UPDATE", entityType: "Product", entityId: id, userId: admin.id, metadata: { overrideFields: Object.keys(parsed.data) } } });
      return presentation;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ overrides: result.value });
  } catch (error) {
    const key = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: key === "NOT_FOUND" ? "Produit introuvable." : key === "VARIANT" ? "Une variante n’appartient pas à ce produit." : key === "CATEGORY" ? "Catégorie introuvable." : key === "RELATED" ? "Une référence de produit associé ou accessoire est introuvable." : "Enregistrement impossible. Rechargez la fiche avant de réessayer." }, { status: key === "NOT_FOUND" ? 404 : ["VARIANT", "RELATED", "CATEGORY"].includes(key) ? 400 : 409 });
  }
}
