
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getStockmanProduct } from "@/lib/suppliers/stockman/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  reference: z.string().trim().min(2).max(31),
  productUrl: z.string().trim().url(),
});

export async function POST(request: Request) {
  const admin = await getCurrentAdmin();

  if (!admin || admin.status !== "ACTIVE") {
    return NextResponse.json(
      { message: "Non autorisé." },
      { status: 401 },
    );
  }

  const parsed = schema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Référence ou URL invalide." },
      { status: 400 },
    );
  }

  try {
    const product = await getStockmanProduct(
      parsed.data.reference,
      parsed.data.productUrl,
    );

    return NextResponse.json(
      {
        reference: product.reference,
        stockStockman: product.stockOnRequest
          ? null
          : product.stock,
        stockFiable: !product.stockOnRequest,
        stockSurDemande: product.stockOnRequest,
        lectureEffectueeLe: product.readAt,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    // Journaliser une categorie technique, jamais le message brut : certains
    // diagnostics fournisseur peuvent contenir des donnees de session.
    const detail = error instanceof Error ? error.message : "";
    const category =
      /session stockman introuvable|stockman-auth\.json|session.*expir/i.test(detail)
        ? "SESSION_ABSENTE_OU_EXPIREE"
        : /login|connexion|identifiez-vous|authentif/i.test(detail)
          ? "AUTHENTIFICATION_REFUSEE"
          : /timeout|timed out|delai|délai/i.test(detail)
            ? "DELAI_LECTURE"
            : /browser|chromium|playwright|executable/i.test(detail)
              ? "NAVIGATEUR_SERVEUR"
              : /reference|référence|commercial|stock|prix|price|parse|ligne/i.test(detail)
                ? "DONNEES_COMMERCIALES_ILLISIBLES"
                : "ERREUR_NON_CLASSEE";
    console.error("[STOCKMAN_TEST_FAILURE]", JSON.stringify({
      reference: parsed.data.reference,
      category,
    }));
    return NextResponse.json(
      { message: "Lecture STOCKMAN impossible.", category },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
