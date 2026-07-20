import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createCustomerSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const customer = await (prisma.customer as any).findUnique({ where: { email }, select: { id: true, passwordHash: true, lastLoginAt: true } });
    if (!customer?.passwordHash || !(await verifyPassword(password, customer.passwordHash))) return NextResponse.json({ error: "Adresse e-mail ou mot de passe incorrect." }, { status: 401 });
    const now = new Date();
    await (prisma.customer as any).update({
      where: { id: customer.id },
      data: {
        previousLoginAt: customer.lastLoginAt ?? null,
        lastLoginAt: now,
      },
    });
    await createCustomerSession(customer.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Customer login failed", error);
    return NextResponse.json({ error: "Connexion momentanément indisponible." }, { status: 500 });
  }
}
