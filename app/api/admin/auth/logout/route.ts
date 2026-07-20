import { NextResponse } from "next/server";
import { clearAdminSession, getCurrentAdmin } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db/prisma";
export async function POST() {
  const admin = await getCurrentAdmin();
  if (admin) await prisma.auditLog.create({ data: { action: "ADMIN_LOGOUT", entityType: "AdminUser", entityId: admin.id, userId: admin.id } }).catch(() => null);
  await clearAdminSession();
  return NextResponse.json({ ok: true });
}
