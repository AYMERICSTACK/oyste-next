import { canWriteContent } from "@/lib/admin/catalogue-permissions";
import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { cmsContentSchema } from "@/lib/cms-validation";
import { mergeCms } from "@/lib/cms-content";
import { getCmsContent, saveCmsContent } from "@/lib/cms";
export async function GET() {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  return NextResponse.json(await getCmsContent());
}
export async function PUT(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!canWriteContent(admin)) return NextResponse.json({ error: "Votre rôle ne permet pas de modifier les contenus." }, { status: 403 });
  const parsed = cmsContentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Contenu invalide. Vérifiez les textes, liens et adresses e-mail.", fields: parsed.error.flatten() }, { status: 400 });
  return NextResponse.json(await saveCmsContent(mergeCms(parsed.data), admin.id));
}
