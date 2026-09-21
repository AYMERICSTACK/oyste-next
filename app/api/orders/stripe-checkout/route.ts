import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentCustomer } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { calculateCartShippingWithSendcloud } from "@/lib/shipping/sendcloud-cart";
import { resolveSecureCheckoutItems } from "@/lib/orders/secure-checkout-items";
import { calculateKitoOrderAdjustment } from "@/lib/pricing/kito-order-adjustment";
import { createOrderReference } from "@/lib/orders/bank-transfer";
import { CGV_VERSION } from "@/lib/legal/cgv-meta";
import { createStripeCheckoutSession } from "@/lib/integrations/stripe";

const itemSchema = z.object({
  kind: z.enum(["catalogue", "configured"]), id: z.string().min(1).max(220), name: z.string().min(1).max(250), code: z.string().max(120).optional(), family: z.string().max(120).optional(), supplier: z.string().max(160).optional(), weightKg: z.number().nonnegative().max(100000).optional(), shippingMode: z.enum(["INCLUDED", "MESSAGERIE", "AFFRETEMENT", "QUOTE"]).optional(), pfiShipping: z.object({ family: z.enum(["PFI", "PFT"]).optional(), capacityKg: z.number().positive(), spanM: z.number().positive(), hsfM: z.number().positive(), fixing: z.enum(["STANDARD", "CHEMICAL"]) }).optional(), wallPotenceShipping: z.object({ family: z.enum(["PMI", "PMT"]), capacityKg: z.number().positive(), spanM: z.number().positive(), additionalWeightKg: z.number().nonnegative().optional(), weightComplete: z.boolean().optional() }).optional(), unitPriceHT: z.number().nonnegative().max(10000000), quantity: z.number().int().min(1).max(99), technicalLines: z.array(z.object({ label: z.string().max(120), value: z.string().max(300) })).max(40).optional(),
});
const schema = z.object({
  items: z.array(itemSchema).min(1).max(100),
  address: z.object({ company: z.string().min(2).max(160), firstName: z.string().min(1).max(80), lastName: z.string().min(1).max(80), address1: z.string().min(3).max(180), address2: z.string().max(180).optional().default(""), postalCode: z.string().regex(/^\d{5}$/), city: z.string().min(2).max(120), country: z.string().length(2).default("FR") }),
  customerNote: z.string().max(2000).optional().default(""), requestedDate: z.string().max(120).optional().default(""),
  cgvAccepted: z.literal(true),
  cgvVersion: z.literal(CGV_VERSION),
});

export async function POST(request: Request) {
  try {
    const customer = await getCurrentCustomer();
    if (!customer) return NextResponse.json({ message: "Connectez-vous pour finaliser votre commande." }, { status: 401 });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ message: "Merci de vérifier les informations de livraison." }, { status: 400 });
    const data = parsed.data;
    const secureItems = await resolveSecureCheckoutItems(data.items);
    const shipping = await calculateCartShippingWithSendcloud(secureItems, data.address.postalCode, data.address.country);
    if (shipping.hasQuote) return NextResponse.json({ message: "Le paiement par carte sera disponible après confirmation du transport." }, { status: 400 });

    const grossSubtotalHt = secureItems.reduce((sum, item) => sum + item.unitPriceHT * item.quantity, 0);
    const kitoAdjustment = await calculateKitoOrderAdjustment(secureItems);
    const kitoDiscountHT = kitoAdjustment?.discountHT || 0;
    const subtotalHt = Math.max(0, grossSubtotalHt - kitoDiscountHT);
    const shippingHt = shipping.confirmedAmountHT;
    const taxAmount = (subtotalHt + shippingHt) * 0.2;
    const totalTtc = subtotalHt + shippingHt + taxAmount;
    let reference = createOrderReference();
    for (let attempt = 0; attempt < 5 && await prisma.order.findUnique({ where: { reference } }); attempt++) reference = createOrderReference();

    const order = await prisma.$transaction(async (tx) => {
      const address = await tx.customerAddress.create({ data: { type: "SHIPPING", label: `Commande ${reference}`, company: data.address.company, firstName: data.address.firstName, lastName: data.address.lastName, address1: data.address.address1, address2: data.address.address2 || null, postalCode: data.address.postalCode, city: data.address.city, country: data.address.country.toUpperCase(), customerId: customer.id } });
      return tx.order.create({ data: { reference, paymentMethod: "CARD", status: "PENDING_PAYMENT", paymentStatus: "PENDING", subtotalHt, taxAmount, totalTtc, customerNote: data.customerNote || null, requestedDate: data.requestedDate || null, cgvVersion: CGV_VERSION, cgvAcceptedAt: new Date(), deliveryMode: "Livraison confirmée", customerId: customer.id, shippingAddressId: address.id, items: { create: [...secureItems.map((item, index) => ({ name: item.name, reference: item.code || null, quantity: item.quantity, unitPriceHt: item.unitPriceHT, totalHt: item.unitPriceHT * item.quantity, configuration: item.technicalLines ? { technicalLines: item.technicalLines, kind: item.kind, pfiShipping: item.pfiShipping, wallPotenceShipping: item.wallPotenceShipping, shipping: shipping.lines[index] } : { kind: item.kind, pfiShipping: item.pfiShipping, wallPotenceShipping: item.wallPotenceShipping, shipping: shipping.lines[index] } })), ...(kitoDiscountHT > 0 ? [{ name: `${kitoAdjustment?.discountReason === "TRANSPORT" ? "Remise transport KITO" : "Remise regroupement KITO"} (-${(kitoAdjustment?.discountPercent || 0).toFixed(1)} %)`, reference: "KITO-DISCOUNT", quantity: 1, unitPriceHt: -kitoDiscountHT, totalHt: -kitoDiscountHT, configuration: { kind: "commercial_adjustment", supplier: "KITO" } }] : [])] }, events: { create: { type: "ORDER_CREATED", title: "Commande enregistrée", description: "Commande reçue. Paiement Stripe en attente.", metadata: { paymentMethod: "CARD", cgvVersion: CGV_VERSION, cgvAccepted: true } } } } });
    });

    const origin = new URL(request.url).origin;
    try {
      const session = await createStripeCheckoutSession({ orderId: order.id, reference, customerId: customer.id, customerEmail: customer.email, amountCents: Math.round(totalTtc * 100), currency: "EUR", successUrl: `${origin}/commande/stripe/success?session_id={CHECKOUT_SESSION_ID}`, cancelUrl: `${origin}/commande?stripe=cancelled` });
      if (!session.url) throw new Error("Stripe n’a pas renvoyé d’URL de paiement.");
      // Prisma sera régénéré après la migration Stripe.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma.order as any).update({ where: { id: order.id }, data: { stripeCheckoutSessionId: session.id, paymentReference: session.id }, });
      await prisma.orderEvent.create({ data: { orderId: order.id, type: "STRIPE_CHECKOUT_CREATED", title: "Session Stripe créée", description: "Le client a été redirigé vers le paiement sécurisé Stripe.", metadata: { sessionId: session.id } } });
      return NextResponse.json({ id: order.id, reference, checkoutUrl: session.url });
    } catch (error) {
      await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "FAILED" } });
      throw error;
    }
  } catch (error) {
    console.error("Stripe checkout error", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Impossible d’ouvrir le paiement Stripe." }, { status: 500 });
  }
}
