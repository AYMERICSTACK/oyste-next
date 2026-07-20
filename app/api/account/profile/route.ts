import { NextResponse } from "next/server";
import { getCurrentCustomer } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

export async function PATCH(request: Request) {
  try {
    const customer = await getCurrentCustomer();
    if (!customer) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const body = await request.json();
    const company = String(body.company ?? "").trim();
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const jobTitle = String(body.jobTitle ?? "").trim() || null;
    const email = String(body.email ?? "").trim().toLowerCase();
    const address1 = String(body.address1 ?? "").trim();
    const address2 = String(body.address2 ?? "").trim() || null;
    const postalCode = String(body.postalCode ?? "").trim();
    const city = String(body.city ?? "").trim();
    const country = String(body.country ?? "FR").trim().toUpperCase();

    if (!company || !firstName || !lastName || !phone || !email || !address1 || !postalCode || !city || !country) {
      return NextResponse.json({ error: "Merci de remplir tous les champs obligatoires." }, { status: 400 });
    }
    if (!EMAIL_PATTERN.test(email)) return NextResponse.json({ error: "L’adresse e-mail n’est pas valide." }, { status: 400 });
    if (email !== customer.email) {
      const existing = await (prisma.customer as any).findUnique({ where: { email }, select: { id: true } });
      if (existing && existing.id !== customer.id) return NextResponse.json({ error: "Cette adresse e-mail est déjà utilisée par un autre compte." }, { status: 409 });
    }

    const existingBilling = await (prisma.customerAddress as any).findFirst({ where: { customerId: customer.id, type: "BILLING" }, select: { id: true } });
    await prisma.$transaction(async (transaction) => {
      await (transaction.customer as any).update({ where: { id: customer.id }, data: { company, firstName, lastName, phone, jobTitle, email } });
      const addressData = { company, firstName, lastName, address1, address2, postalCode, city, country };
      if (existingBilling) await (transaction.customerAddress as any).update({ where: { id: existingBilling.id }, data: addressData });
      else await (transaction.customerAddress as any).create({ data: { ...addressData, type: "BILLING", label: "Adresse professionnelle", customerId: customer.id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Customer profile update failed", error);
    return NextResponse.json({ error: "Impossible d’enregistrer vos informations pour le moment." }, { status: 500 });
  }
}
