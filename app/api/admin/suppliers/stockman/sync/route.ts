import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getStockmanProduct } from "@/lib/suppliers/stockman/client";
import { syncStockmanProduct } from "@/lib/suppliers/stockman/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ reference: z.string().trim().min(2).max(31), productUrl: z.string().trim().url() });

export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== "ACTIVE") return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  if (admin.role === "READ_ONLY") return NextResponse.json({ message: "Votre rôle ne permet pas de modifier le catalogue." }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Renseignez une référence et l’URL de sa fiche Stockman." }, { status: 400 });

  try {
    const product = await getStockmanProduct(parsed.data.reference, parsed.data.productUrl);
    const sync = await syncStockmanProduct(product, undefined, ["price", "stock", "weight"]);
    return NextResponse.json({ product, sync }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "La synchronisation Stockman a échoué.";
    return NextResponse.json({ message }, { status: 502 });
  }
}
