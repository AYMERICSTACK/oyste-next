import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { createCustomerSession } from "@/lib/auth/session";
import { isValidSiret, normalizeSiret } from "@/lib/auth/siret";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const company = String(body.company ?? "").trim();
    const siret = normalizeSiret(String(body.siret ?? ""));
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const jobTitle = String(body.jobTitle ?? "").trim() || null;
    const phone = String(body.phone ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!company || !firstName || !lastName || !phone || !email || !password) return NextResponse.json({ error: "Merci de remplir tous les champs obligatoires." }, { status: 400 });
    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "L’adresse e-mail n’est pas valide." }, { status: 400 });
    if (!isValidSiret(siret)) return NextResponse.json({ error: "Le numéro SIRET doit contenir 14 chiffres et être valide." }, { status: 400 });
    if (password.length < 10 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) return NextResponse.json({ error: "Le mot de passe doit contenir au moins 10 caractères, une majuscule, une minuscule et un chiffre." }, { status: 400 });

    const existing = await (prisma.customer as any).findFirst({ where: { OR: [{ email }, { siret }] }, select: { email: true, siret: true } });
    if (existing?.email === email) return NextResponse.json({ error: "Un compte existe déjà avec cette adresse e-mail." }, { status: 409 });
    if (existing?.siret === siret) return NextResponse.json({ error: "Une entreprise est déjà enregistrée avec ce SIRET." }, { status: 409 });

    const customer = await (prisma.customer as any).create({ data: { email, company, siret, firstName, lastName, jobTitle, phone, passwordHash: await hashPassword(password), lastLoginAt: new Date() }, select: { id: true } });
    await createCustomerSession(customer.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Customer registration failed", error);
    return NextResponse.json({ error: "Impossible de créer le compte pour le moment." }, { status: 500 });
  }
}
