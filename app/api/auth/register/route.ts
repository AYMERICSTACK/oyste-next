import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { createCustomerSession } from "@/lib/auth/session";
import {
  isSirenConsistentWithSiret,
  isValidSiren,
  isValidSiret,
  normalizeSiren,
  normalizeSiret,
  normalizeVatNumber,
} from "@/lib/auth/siret";

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const company = String(body.company ?? "").trim();
    const siret = normalizeSiret(String(body.siret ?? ""));
    const siren = normalizeSiren(siret.slice(0, 9));
    const vatNumber = normalizeVatNumber(String(body.vatNumber ?? "")) || null;
    const electronicBillingAddress = String(body.electronicBillingAddress ?? "").trim() || null;
    const address1 = String(body.address1 ?? "").trim();
    const address2 = String(body.address2 ?? "").trim() || null;
    const postalCode = String(body.postalCode ?? "").trim();
    const city = String(body.city ?? "").trim();
    const country = String(body.country ?? "FR").trim().toUpperCase();
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const jobTitle = String(body.jobTitle ?? "").trim() || null;
    const phone = String(body.phone ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!company || !siren || !siret || !address1 || !postalCode || !city || !country || !firstName || !lastName || !phone || !email || !password) {
      return NextResponse.json({ error: "Merci de remplir tous les champs obligatoires." }, { status: 400 });
    }
    if (!EMAIL_PATTERN.test(email)) return NextResponse.json({ error: "L’adresse e-mail n’est pas valide." }, { status: 400 });
    if (!isValidSiren(siren)) return NextResponse.json({ error: "Le numéro SIREN doit contenir 9 chiffres et être valide." }, { status: 400 });
    if (!isValidSiret(siret)) return NextResponse.json({ error: "Le numéro SIRET doit contenir 14 chiffres et être valide." }, { status: 400 });
    if (!isSirenConsistentWithSiret(siren, siret)) return NextResponse.json({ error: "Le SIREN doit correspondre aux 9 premiers chiffres du SIRET." }, { status: 400 });
    if (vatNumber && !/^[A-Z]{2}[A-Z0-9]{2,13}$/.test(vatNumber)) return NextResponse.json({ error: "Le numéro de TVA intracommunautaire n’est pas valide." }, { status: 400 });
    if (password.length < 10 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) return NextResponse.json({ error: "Le mot de passe doit contenir au moins 10 caractères, une majuscule, une minuscule et un chiffre." }, { status: 400 });

    const existing = await (prisma.customer as any).findFirst({
      where: { OR: [{ email }, { siren }, { siret }] },
      select: { email: true, siren: true, siret: true },
    });
    if (existing?.email === email) return NextResponse.json({ error: "Un compte existe déjà avec cette adresse e-mail." }, { status: 409 });
    if (existing?.siren === siren) return NextResponse.json({ error: "Une entreprise est déjà enregistrée avec ce SIREN." }, { status: 409 });
    if (existing?.siret === siret) return NextResponse.json({ error: "Une entreprise est déjà enregistrée avec ce SIRET." }, { status: 409 });

    const customer = await prisma.$transaction(async (transaction) => {
      const created = await (transaction.customer as any).create({
        data: {
          email, company, siren, siret, vatNumber, electronicBillingAddress, firstName, lastName, jobTitle, phone,
          passwordHash: await hashPassword(password),
          lastLoginAt: new Date(),
        },
        select: { id: true },
      });

      await (transaction.customerAddress as any).create({
        data: {
          type: "BILLING",
          label: "Adresse de facturation",
          company, firstName, lastName, address1, address2, postalCode, city, country,
          customerId: created.id,
        },
      });
      return created;
    });

    await createCustomerSession(customer.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Customer registration failed", error);
    return NextResponse.json({ error: "Impossible de créer le compte pour le moment." }, { status: 500 });
  }
}
