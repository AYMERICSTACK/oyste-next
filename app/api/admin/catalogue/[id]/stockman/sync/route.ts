import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db/prisma";
import { getStockmanProduct } from "@/lib/suppliers/stockman/client";
import { syncStockmanProduct } from "@/lib/suppliers/stockman/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ targetType: z.enum(["product", "variant"]), targetId: z.string().min(1) });

type SourceObject = Record<string, unknown>;

function stockmanSource(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const stockman = (value as SourceObject).stockman;
  if (!stockman || typeof stockman !== "object" || Array.isArray(stockman)) return null;
  const source = stockman as SourceObject;
  return {
    reference: typeof source.reference === "string" ? source.reference : "",
    sourceUrl: typeof source.sourceUrl === "string" ? source.sourceUrl : "",
  };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== "ACTIVE") return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  if (admin.role === "READ_ONLY") return NextResponse.json({ message: "Votre rôle ne permet pas de modifier le catalogue." }, { status: 403 });

  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Cible de synchronisation invalide." }, { status: 400 });

  if (parsed.data.targetType === "product" && parsed.data.targetId !== id) {
    return NextResponse.json({ message: "La référence ne correspond pas à ce produit." }, { status: 404 });
  }
  const target = parsed.data.targetType === "product"
    ? await prisma.product.findUnique({ where: { id }, select: { id: true, supplierCode: true, sourceData: true } })
    : await prisma.productVariant.findFirst({ where: { id: parsed.data.targetId, productId: id }, select: { id: true, supplierCode: true, sourceData: true } });

  if (!target) return NextResponse.json({ message: "La référence ne correspond pas à ce produit." }, { status: 404 });
  const source = stockmanSource(target.sourceData);
  const reference = source?.reference || target.supplierCode || "";
  const productUrl = source?.sourceUrl || "";
  if (!reference || !productUrl) return NextResponse.json({ message: "Cette référence n’a pas encore de fiche Stockman liée. Effectuez d’abord une synchronisation depuis Fournisseurs." }, { status: 400 });

  try {
    const product = await getStockmanProduct(reference, productUrl);
    const sync = await syncStockmanProduct(
      product,
      { targetType: parsed.data.targetType, targetId: parsed.data.targetId, productId: id },
      ["price", "stock", "weight"],
      parsed.data.targetType === "product",
    );
    return NextResponse.json({ product, sync }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "La synchronisation Stockman a échoué.";
    return NextResponse.json({ message }, { status: 502 });
  }
}
