import { NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { syncAdeiLeadTimes } from "@/lib/suppliers/adei/lead-times";

export const dynamic = "force-dynamic";

export async function POST() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  if (admin.role === "READ_ONLY") {
    return NextResponse.json({ error: "Votre rôle ne permet pas de lancer cette synchronisation." }, { status: 403 });
  }

  try {
    const result = await syncAdeiLeadTimes();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Synchronisation des délais impossible.",
        retained: true,
      },
      { status: 502 },
    );
  }
}
