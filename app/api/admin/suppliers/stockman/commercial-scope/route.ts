import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { getSharedStockmanScope, parseSharedStockmanScope, stockmanCommercialSetting, stockmanCommercialSettingSchema } from "@/lib/suppliers/stockman/shared-commercial-scope";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const writeSchema = stockmanCommercialSettingSchema.extend({ version: z.iso.datetime().nullable() });

export async function GET() {
  const admin = await getCurrentAdmin();
  if (admin?.status !== "ACTIVE") return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  return NextResponse.json({ scope: await getSharedStockmanScope(), writable: admin.role === "SUPER_ADMIN" }, { headers });
}

export async function PUT(request: Request) {
  const admin = await getCurrentAdmin();
  if (admin?.status !== "ACTIVE" || admin.role !== "SUPER_ADMIN") return NextResponse.json({ message: "Enregistrement réservé au super administrateur." }, { status: 403 });
  const parsed = writeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Périmètre invalide." }, { status: 400 });
  let value;
  try { value = parseSharedStockmanScope(parsed.data); }
  catch { return NextResponse.json({ message: "Périmètre invalide." }, { status: 400 }); }
  const scope = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(193701, 3)`;
    const prior = await tx.siteSetting.findUnique({ where: { key: stockmanCommercialSetting }, select: { updatedAt: true } });
    if ((prior?.updatedAt.toISOString() ?? null) !== parsed.data.version) return null;
    const changed = await tx.siteSetting.upsert({
      where: { key: stockmanCommercialSetting },
      create: { key: stockmanCommercialSetting, value, description: "Périmètre partagé STOCKMAN", isPublic: false },
      update: { value, isPublic: false },
    });
    await tx.auditLog.create({ data: {
      action: "STOCKMAN_COMMERCIAL_SCOPE_SAVE", entityType: "SiteSetting", entityId: stockmanCommercialSetting, userId: admin.id, metadata: value,
    } });
    return { ...value, version: changed.updatedAt.toISOString() };
  });
  if (!scope) return NextResponse.json({ message: "Le périmètre a été modifié. Rechargez la page pour reprendre le dernier réglage." }, { status: 409 });
  return NextResponse.json({ scope }, { headers });
}
