import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db/prisma";
import { reconcileStockmanCatalog } from "@/lib/suppliers/stockman/catalog-reconciliation";
import { buildLiftTableBatchV33 } from "@/lib/suppliers/stockman/lift-table-batch-v33";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** V33: secure, read-only lift-table preparation. No POST endpoint. */
export async function GET() {
  try {
    const admin = await getCurrentAdmin();
    if (!admin || admin.status !== "ACTIVE") return NextResponse.json({ error: "Acces administrateur requis." }, { status: 401 });
    const supplier = await prisma.supplier.findFirst({
      where: { OR: [
        { slug: { equals: "stockman", mode: "insensitive" } },
        { name: { equals: "STOCKMAN", mode: "insensitive" } },
      ] }, select: { id: true },
    });
    if (!supplier) return NextResponse.json({ error: "Fournisseur STOCKMAN introuvable." }, { status: 409 });
    const [references, drafts, products, variants] = await Promise.all([
      prisma.stockmanCatalogReference.findMany({
        orderBy: { reference: "asc" },
        select: { reference: true, designation: true, category: true, sourceUrl: true, isActive: true,
          targetId: true, targetType: true, productId: true, lastMatchStatus: true },
      }),
      prisma.stockmanImportDraft.findMany({ select: { reference: true, status: true,
        sourceReadAt: true, purchasePriceExVat: true, stock: true, weightKg: true } }),
      prisma.product.findMany({ where: { supplierId: supplier.id }, select: {
        id: true, code: true, supplierCode: true, publicationStatus: true, sourceData: true,
      } }),
      prisma.productVariant.findMany({ where: { product: { supplierId: supplier.id } }, select: {
        id: true, productId: true, code: true, supplierCode: true, sourceData: true,
      } }),
    ]);
    if ([references, drafts, products, variants].some(a => a.length > 30000))
      return NextResponse.json({ error: "Diagnostic trop volumineux." }, { status: 413 });
    const reconciled = reconcileStockmanCatalog(references, drafts, products, variants);
    const batch = buildLiftTableBatchV33(reconciled, drafts);
    return NextResponse.json({ ...batch, generatedAt: new Date().toISOString(), sourceIndexMatches: references.length },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[STOCKMAN_LIFT_TABLE_V33]", error instanceof Error ? error.message : "Erreur inconnue");
    return NextResponse.json({ error: "Preparation des tables indisponible." }, { status: 500 });
  }
}
