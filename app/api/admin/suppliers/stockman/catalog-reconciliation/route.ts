import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db/prisma";
import { reconcileStockmanCatalog, summarizeStockmanReconciliation } from "@/lib/suppliers/stockman/catalog-reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** V32: administrative read-only reconciliation. Never invokes supplier browser or database writes. */
export async function GET(request: Request) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin || admin.status !== "ACTIVE") return NextResponse.json({ error: "Acces administrateur requis." }, { status: 401 });
    const url = new URL(request.url);
    const offsetRaw = url.searchParams.get("offset") ?? "0";
    const limitRaw = url.searchParams.get("limit") ?? "100";
    if (!/^\d{1,6}$/.test(offsetRaw) || !/^\d{1,3}$/.test(limitRaw)) return NextResponse.json({ error: "Pagination invalide." }, { status: 400 });
    const offset = Number(offsetRaw);
    const limit = Number(limitRaw);
    if (offset > 100000 || limit < 1 || limit > 200) return NextResponse.json({ error: "Pagination hors limites." }, { status: 400 });
    const state = url.searchParams.get("status");
    const accepted = new Set(["CONFIRMED_IN_OYSTE", "AMBIGUOUS_MATCH", "INDEX_LINK_UNVERIFIED", "DRAFT_NO_PRODUCT", "SOURCE_REVIEW", "INACTIVE"]);
    if (state && !accepted.has(state)) return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
    const family = url.searchParams.get("family")?.trim() || null;
    if (family && family.length > 250) return NextResponse.json({ error: "Famille trop longue." }, { status: 400 });

    const supplier = await prisma.supplier.findFirst({
      where: { OR: [{ slug: { equals: "stockman", mode: "insensitive" } }, { name: { equals: "STOCKMAN", mode: "insensitive" } }] },
      select: { id: true },
    });
    if (!supplier) return NextResponse.json({ error: "Fournisseur STOCKMAN introuvable; reconciliation impossible." }, { status: 409 });
    const [references, drafts, products, variants, snapshot] = await Promise.all([
      prisma.stockmanCatalogReference.findMany({ orderBy: { reference: "asc" }, select: {
        reference: true, designation: true, category: true, sourceUrl: true, isActive: true, targetId: true,
        targetType: true, productId: true, lastMatchStatus: true,
      } }),
      prisma.stockmanImportDraft.findMany({ select: { reference: true, status: true, sourceReadAt: true, purchasePriceExVat: true, stock: true } }),
      prisma.product.findMany({ where: { supplierId: supplier.id }, select: {
        id: true, code: true, supplierCode: true, publicationStatus: true, sourceData: true,
      } }),
      prisma.productVariant.findMany({ where: { product: { supplierId: supplier.id } }, select: {
        id: true, productId: true, code: true, supplierCode: true, sourceData: true,
      } }),
      prisma.stockmanCatalogSnapshot.findFirst({ orderBy: { finishedAt: "desc" }, select: { finishedAt: true, referencesCount: true } }),
    ]);
    if (references.length > 30000 || drafts.length > 30000 || products.length > 30000 || variants.length > 30000) {
      return NextResponse.json({ error: "Catalogue trop volumineux pour ce diagnostic." }, { status: 413 });
    }
    const rows = reconcileStockmanCatalog(references, drafts, products, variants);
    const summary = summarizeStockmanReconciliation(rows);
    const filtered = rows.filter(row => (!state || row.reconciliationStatus === state) && (!family || row.category === family));
    return NextResponse.json({
      version: "STOCKMAN_CATALOG_RECONCILIATION_V32", mode: "READ_ONLY",
      generatedAt: new Date().toISOString(),
      snapshot: snapshot ? { finishedAt: snapshot.finishedAt.toISOString(), referencesCount: snapshot.referencesCount } : null,
      catalog: { stockmanProducts: products.length, stockmanVariants: variants.length, indexEntries: references.length, draftEntries: drafts.length },
      summary,
      pagination: { offset, limit, filteredTotal: filtered.length, nextOffset: offset + limit < filtered.length ? offset + limit : null },
      rows: filtered.slice(offset, offset + limit),
      warnings: [
        "Correspondance exacte de reference dans Product ou ProductVariant STOCKMAN; aucun rapprochement approximatif.",
        "Une liaison d index ne prouve pas que l article existe dans Product/Variant.",
        "Une reference liee ou un brouillon ne garantit ni prix actuel ni stock frais.",
        "Des codes identiques sur plusieurs entites sont classes ambigus, jamais libres a importer.",
        "Les produits en brouillon restent inchanges. Aucune creation, modification ou publication n est effectuee.",
      ],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[STOCKMAN_RECONCILIATION_V32]", error instanceof Error ? error.message : "Erreur inconnue");
    return NextResponse.json({ error: "Rapprochement indisponible." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
