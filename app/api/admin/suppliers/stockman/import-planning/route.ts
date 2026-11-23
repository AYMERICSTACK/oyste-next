import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db/prisma";
import { planStockmanReferences, summarizeStockmanPlanning } from "@/lib/suppliers/stockman/import-planning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** V31: read-only bounded import planning; never fetches STOCKMAN or writes to Neon. */
export async function GET(request: Request) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin || admin.status !== "ACTIVE") return NextResponse.json({ error: "Acces administrateur requis." }, { status: 401 });
    const url = new URL(request.url);
    const offsetRaw = url.searchParams.get("offset") ?? "0";
    const limitRaw = url.searchParams.get("limit") ?? "100";
    if (!/^\d{1,6}$/.test(offsetRaw) || !/^\d{1,3}$/.test(limitRaw)) return NextResponse.json({ error: "Pagination invalide." }, { status: 400 });
    const offset = Number(offsetRaw), limit = Number(limitRaw);
    if (offset > 100000 || limit < 1 || limit > 200) return NextResponse.json({ error: "Pagination hors limites." }, { status: 400 });
    const [references, drafts, snapshot] = await Promise.all([
      prisma.stockmanCatalogReference.findMany({
        orderBy: { reference: "asc" },
        select: { reference: true, designation: true, category: true, sourceUrl: true, isActive: true, targetId: true, productId: true, lastMatchStatus: true },
      }),
      prisma.stockmanImportDraft.findMany({
        select: { reference: true, status: true, sourceReadAt: true, purchasePriceExVat: true, stock: true },
      }),
      prisma.stockmanCatalogSnapshot.findFirst({ orderBy: { finishedAt: "desc" }, select: { finishedAt: true, referencesCount: true } }),
    ]);
    // Do not silently return partial summaries when an index grows beyond this endpoint's scope.
    if (references.length > 30000 || drafts.length > 30000) return NextResponse.json({ error: "Inventaire trop volumineux pour cet apercu." }, { status: 413 });
    const rows = planStockmanReferences(references, drafts);
    const summary = summarizeStockmanPlanning(rows);
    const state = url.searchParams.get("state");
    const accepted = new Set(["ALREADY_LINKED", "PREPARED_DRAFT", "SOURCE_REVIEW", "INACTIVE"]);
    if (state && !accepted.has(state)) return NextResponse.json({ error: "Etat de filtre invalide." }, { status: 400 });
    const category = url.searchParams.get("category")?.trim();
    if (category && category.length > 250) return NextResponse.json({ error: "Categorie trop longue." }, { status: 400 });
    const filtered = rows.filter(r => (!state || r.state === state) && (!category || r.category === category));
    return NextResponse.json({
      version: "STOCKMAN_IMPORT_PLANNING_V31",
      mode: "READ_ONLY",
      generatedAt: new Date().toISOString(),
      snapshot: snapshot ? { finishedAt: snapshot.finishedAt.toISOString(), referencesCount: snapshot.referencesCount } : null,
      summary,
      pagination: { offset, limit, filteredTotal: filtered.length, nextOffset: offset + limit < filtered.length ? offset + limit : null },
      rows: filtered.slice(offset, offset + limit),
      warnings: [
        "Les references de l'index durable ne contiennent pas toujours les badges ACCESSOIRE ni les relations parent/variantes.",
        "ACCESSORY_PATH_REVIEW est un indice de navigation et non une preuve de nature commerciale.",
        "PREPARED_DRAFT ne prouve ni stock actuel, ni prix valide, ni autorisation de publication.",
        "Aucun import ni reclassement automatique n'est autorise par cet apercu.",
      ],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[STOCKMAN_IMPORT_PLANNING_V31]", error instanceof Error ? error.message : "Erreur inconnue");
    return NextResponse.json({ error: "Apercu indisponible." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
