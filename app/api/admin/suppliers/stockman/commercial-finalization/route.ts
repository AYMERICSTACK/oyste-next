import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/admin-session";

export async function POST() {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== "ACTIVE") return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  if (admin.role === "READ_ONLY") return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  return NextResponse.json({ error: "Finalisation globale désactivée : le coût réel du transport doit être validé référence par référence. Aucun produit ni tarif modifié." }, { status: 409 });
}
