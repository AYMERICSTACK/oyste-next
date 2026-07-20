import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createAdminSession } from "@/lib/auth/admin-session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!email || !password) return NextResponse.json({ error: "Renseignez votre e-mail et votre mot de passe." }, { status: 400 });

  let admin = await prisma.adminUser.findUnique({ where: { email } });
  const bootstrapEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const bootstrapPassword = process.env.ADMIN_PASSWORD;
  if (!admin && bootstrapEmail === email && bootstrapPassword === password) {
    admin = await prisma.adminUser.create({ data: { email, firstName: process.env.ADMIN_FIRST_NAME || "Administrateur", lastName: process.env.ADMIN_LAST_NAME || "OYSTE", passwordHash: await hashPassword(password), role: "SUPER_ADMIN", status: "ACTIVE", activatedAt: new Date() } });
  }
  if (!admin?.passwordHash || admin.status !== "ACTIVE" || !(await verifyPassword(password, admin.passwordHash))) {
    return NextResponse.json({ error: "Identifiants incorrects ou accès non activé." }, { status: 401 });
  }
  await prisma.$transaction([
    prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } }),
    prisma.auditLog.create({ data: { action: "ADMIN_LOGIN", entityType: "AdminUser", entityId: admin.id, userId: admin.id } }),
  ]);
  await createAdminSession(admin.id);
  return NextResponse.json({ ok: true });
}
