import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getCmsContent, saveCmsContent } from "@/lib/cms";
export async function GET() {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  return NextResponse.json(await getCmsContent());
}
export async function PUT(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (admin.role === "READ_ONLY") return NextResponse.json({ error: "Votre rôle ne permet pas de modifier les contenus." }, { status: 403 });
  const value = await request.json();
  return NextResponse.json(await saveCmsContent(value, admin.id));
}
