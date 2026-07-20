import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentCustomer } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { calculateCartShipping } from "@/lib/shipping";
import { createOrderReference } from "@/lib/orders/bank-transfer";
import { buildBankTransferOrderEmail } from "@/lib/orders/order-email";

const itemSchema = z.object({
  kind: z.enum(["catalogue", "configured"]), id: z.string().min(1).max(220), name: z.string().min(1).max(250), code: z.string().max(120).optional(), family: z.string().max(120).optional(), supplier: z.string().max(160).optional(), weightKg: z.number().nonnegative().max(100000).optional(), shippingMode: z.enum(["INCLUDED", "MESSAGERIE", "AFFRETEMENT", "QUOTE"]).optional(), unitPriceHT: z.number().nonnegative().max(10000000), quantity: z.number().int().min(1).max(99), technicalLines: z.array(z.object({ label: z.string().max(120), value: z.string().max(300) })).max(40).optional(),
});
const schema = z.object({
  items: z.array(itemSchema).min(1).max(100),
  address: z.object({ company: z.string().min(2).max(160), firstName: z.string().min(1).max(80), lastName: z.string().min(1).max(80), address1: z.string().min(3).max(180), address2: z.string().max(180).optional().default(""), postalCode: z.string().regex(/^\d{5}$/), city: z.string().min(2).max(120), country: z.string().length(2).default("FR") }),
  customerNote: z.string().max(2000).optional().default(""), requestedDate: z.string().max(120).optional().default(""),
});
async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.ORDER_FROM_EMAIL || process.env.CONTACT_FROM_EMAIL || "OYSTE <onboarding@resend.dev>", to: [to], subject, html, reply_to: process.env.CONTACT_TO_EMAIL }) });
  if (!response.ok) console.error("Order email error", response.status, await response.text());
  return response.ok;
}
export async function POST(request: Request) {
  try {
    const customer = await getCurrentCustomer();
    if (!customer) return NextResponse.json({ message: "Connectez-vous pour finaliser votre commande." }, { status: 401 });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ message: "Merci de vérifier les informations de livraison." }, { status: 400 });
    const data = parsed.data;
    const shipping = calculateCartShipping(data.items, data.address.postalCode);
    const subtotalHt = data.items.reduce((sum, item) => sum + item.unitPriceHT * item.quantity, 0);
    const shippingHt = shipping.hasQuote ? 0 : shipping.confirmedAmountHT;
    const taxableHt = subtotalHt + shippingHt;
    const taxAmount = taxableHt * 0.2;
    const totalTtc = taxableHt + taxAmount;
    let reference = createOrderReference();
    for (let attempt = 0; attempt < 5 && await prisma.order.findUnique({ where: { reference } }); attempt++) reference = createOrderReference();
    const order = await prisma.$transaction(async (tx) => {
      const address = await tx.customerAddress.create({ data: { type: "SHIPPING", label: `Commande ${reference}`, company: data.address.company, firstName: data.address.firstName, lastName: data.address.lastName, address1: data.address.address1, address2: data.address.address2 || null, postalCode: data.address.postalCode, city: data.address.city, country: data.address.country.toUpperCase(), customerId: customer.id } });
      return (tx.order as any).create({ data: { reference, paymentReference: reference, paymentMethod: "BANK_TRANSFER", status: "PENDING_PAYMENT", paymentStatus: "PENDING", subtotalHt, taxAmount, totalTtc, customerNote: data.customerNote || null, requestedDate: data.requestedDate || null, deliveryMode: shipping.hasQuote ? "Transport à confirmer" : "Livraison confirmée", customerId: customer.id, shippingAddressId: address.id, items: { create: data.items.map((item) => ({ name: item.name, reference: item.code || null, quantity: item.quantity, unitPriceHt: item.unitPriceHT, totalHt: item.unitPriceHT * item.quantity, configuration: item.technicalLines ? { technicalLines: item.technicalLines, kind: item.kind, shipping: shipping.lines[data.items.indexOf(item)] } : { kind: item.kind, shipping: shipping.lines[data.items.indexOf(item)] } })) }, events: { create: { type: "ORDER_CREATED", title: "Commande enregistrée", description: shipping.hasQuote ? "Commande reçue. Le montant du transport doit être confirmé avant règlement." : "Commande reçue. Paiement par virement bancaire en attente.", metadata: { paymentMethod: "BANK_TRANSFER", shippingRequiresConfirmation: shipping.hasQuote } } } }, include: { items: true } });
    });
    const emailSent = await sendEmail(customer.email, `OYSTE — Confirmation de votre commande ${reference}`, buildBankTransferOrderEmail({ reference, firstName: customer.firstName || "", company: customer.company || data.address.company, totalTtc, currency: "EUR", requiresShippingConfirmation: shipping.hasQuote, items: order.items.map((item: any) => ({ name: item.name, reference: item.reference, quantity: item.quantity, totalHt: Number(item.totalHt) })) }));
    if (emailSent) await (prisma.order as any).update({ where: { id: order.id }, data: { paymentInstructionsSentAt: new Date() } });
    return NextResponse.json({ id: order.id, reference, requiresShippingConfirmation: shipping.hasQuote });
  } catch (error) {
    console.error("Bank transfer order error", error);
    return NextResponse.json({ message: "La commande n’a pas pu être enregistrée. Merci de réessayer." }, { status: 500 });
  }
}
