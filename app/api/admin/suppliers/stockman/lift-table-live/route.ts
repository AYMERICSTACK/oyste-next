import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db/prisma";
import { getStockmanCommercialFamily } from "@/lib/suppliers/stockman/client";
import { reconcileStockmanCatalog } from "@/lib/suppliers/stockman/catalog-reconciliation";
import { auditLiftTableLiveV34, isPilotV34, PILOTS_V34, type PilotIndexRowV34 } from "@/lib/suppliers/stockman/lift-table-live-v34";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** One authenticated, bounded supplier page per request. No POST / database writes. */
export async function GET(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== "ACTIVE") return reply({ error: "Acces administrateur requis." }, 401);
  const url = new URL(request.url);
  const pilot = url.searchParams.get("pilot");
  if (!isPilotV34(pilot)) return reply({ error: "Parametre pilot attendu: STF_N ou BS." }, 400);
  try {
    const supplier = await prisma.supplier.findFirst({
      where: { OR: [{ slug: { equals: "stockman", mode: "insensitive" } }, { name: { equals: "STOCKMAN", mode: "insensitive" } }] },
      select: { id: true },
    });
    if (!supplier) return reply({ error: "Fournisseur STOCKMAN introuvable." }, 409);
    const refs: string[] = [...PILOTS_V34[pilot].references];
    const [index, drafts, products, variants] = await Promise.all([
      prisma.stockmanCatalogReference.findMany({ where: { reference: { in: refs } }, select: { reference: true, designation: true, category: true, sourceUrl: true, isActive: true, targetId: true, targetType: true, productId: true, lastMatchStatus: true } }),
      prisma.stockmanImportDraft.findMany({ where: { reference: { in: refs } }, select: { reference: true, status: true, sourceReadAt: true, purchasePriceExVat: true, stock: true } }),
      prisma.product.findMany({ where: { supplierId: supplier.id }, select: { id: true, code: true, supplierCode: true, publicationStatus: true, sourceData: true } }),
      prisma.productVariant.findMany({ where: { product: { supplierId: supplier.id } }, select: { id: true, productId: true, code: true, supplierCode: true, sourceData: true } }),
    ]);
    if (products.length > 30000 || variants.length > 30000) return reply({ error: "Catalogue trop volumineux." }, 413);
    const reconciled = reconcileStockmanCatalog(index, drafts, products, variants);
    const byRef = new Map(reconciled.map(r => [r.reference.trim().toUpperCase(), r]));
    const validated: PilotIndexRowV34[] = index.map(r => {
      const rr = byRef.get(r.reference.trim().toUpperCase());
      return { reference: r.reference, sourceUrl: r.sourceUrl,
        isActive: r.isActive, reconciliationStatus: rr?.reconciliationStatus ?? "UNKNOWN",
        referenceQuality: rr?.referenceQuality ?? "SUSPECT_REVIEW" };
    });
    // Do not visit the supplier when even one expected reference is absent or already imported.
    if (refs.some(ref => validated.filter(r => r.reference.trim().toUpperCase() === ref).length !== 1 ||
      validated.some(r => r.reference.trim().toUpperCase() === ref &&
        (!r.isActive || r.reconciliationStatus !== "SOURCE_REVIEW" || r.referenceQuality === "SUSPECT_REVIEW"))))
      return reply({ version: "STOCKMAN_LIFT_TABLE_LIVE_V34", mode: "READ_ONLY", pilot,
        error: "Index absent, suspect ou reference deja rapprochee: lecture fournisseur suspendue.",
        index: validated }, 409);
    const config = PILOTS_V34[pilot];
    const family = await getStockmanCommercialFamily(config.references[0], config.sourceUrl);
    return reply(auditLiftTableLiveV34(pilot, validated, family, new Date().toISOString()));
  } catch (error) {
    console.error("[STOCKMAN_LIFT_TABLE_LIVE_V34]", error instanceof Error ? error.message : "Erreur inconnue");
    return reply({ error: "Lecture fournisseur indisponible. Verifier la session STOCKMAN et reessayer sans importer." }, 503);
  }
}
