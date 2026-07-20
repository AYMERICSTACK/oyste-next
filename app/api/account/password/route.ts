import { NextResponse } from "next/server";
import { getCurrentCustomer } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";

function passwordIsStrong(password: string) {
  return password.length >= 10 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password);
}

export async function PATCH(request: Request) {
  try {
    const customer = await getCurrentCustomer();
    if (!customer) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    const body = await request.json();
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");
    const passwordConfirmation = String(body.passwordConfirmation ?? "");

    if (!currentPassword || !newPassword || !passwordConfirmation) return NextResponse.json({ error: "Merci de remplir les trois champs." }, { status: 400 });
    if (newPassword !== passwordConfirmation) return NextResponse.json({ error: "La confirmation ne correspond pas au nouveau mot de passe." }, { status: 400 });
    if (!passwordIsStrong(newPassword)) return NextResponse.json({ error: "Le nouveau mot de passe doit contenir au moins 10 caractères, une majuscule, une minuscule et un chiffre." }, { status: 400 });

    const record = await (prisma.customer as any).findUnique({ where: { id: customer.id }, select: { passwordHash: true } });
    if (!record?.passwordHash || !(await verifyPassword(currentPassword, record.passwordHash))) return NextResponse.json({ error: "Le mot de passe actuel est incorrect." }, { status: 400 });
    if (await verifyPassword(newPassword, record.passwordHash)) return NextResponse.json({ error: "Le nouveau mot de passe doit être différent de l’ancien." }, { status: 400 });

    await (prisma.customer as any).update({ where: { id: customer.id }, data: { passwordHash: await hashPassword(newPassword) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Customer password update failed", error);
    return NextResponse.json({ error: "Impossible de modifier le mot de passe pour le moment." }, { status: 500 });
  }
}
