import { prisma } from "@/lib/db/prisma";
import { runStripeInvoiceAutomation } from "@/lib/invoices/stripe-invoice-automation";
import { sendOysteEmail } from "@/lib/email/resend";
import { buildInternalNewOrderEmail, buildPaymentConfirmationEmail } from "@/lib/orders/order-email";
import type { StripeCheckoutSession } from "@/lib/integrations/stripe";

function paymentIntentId(session: StripeCheckoutSession) {
  return typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null;
}

export async function confirmPaidStripeOrder(session: StripeCheckoutSession) {
  if (session.payment_status !== "paid") return { confirmed: false, reason: "not_paid" as const };
  const orderId = session.metadata?.orderId || session.client_reference_id;
  if (!orderId) return { confirmed: false, reason: "missing_order" as const };

  const order = await prisma.order.findFirst({
    where: { id: orderId, paymentMethod: "CARD", stripeCheckoutSessionId: session.id },
    include: { customer: true, shippingAddress: true },
  });
  if (!order) return { confirmed: false, reason: "order_not_found" as const };

  const intentId = paymentIntentId(session);
  const updated = await prisma.order.updateMany({
    where: { id: order.id, paymentStatus: { not: "PAID" } },
    data: {
      paymentStatus: "PAID",
      status: "PAID",
      paidAt: new Date(),
      stripePaymentIntentId: intentId,
      paymentReference: intentId || session.id,
    },
  });

  if (updated.count === 0) return { confirmed: true, newlyPaid: false, orderId: order.id };

  await prisma.orderEvent.create({
    data: {
      orderId: order.id,
      type: "PAYMENT_RECEIVED",
      title: "Paiement Stripe reçu",
      description: "Le paiement par carte a été confirmé par Stripe.",
      metadata: { sessionId: session.id, paymentIntentId: intentId },
    },
  });

  try {
    const sent = await sendOysteEmail({
      to: order.customer.email,
      subject: `OYSTE — Paiement confirmé pour ${order.reference}`,
      html: buildPaymentConfirmationEmail({
        reference: order.reference,
        firstName: order.customer.firstName,
        company: order.customer.company,
        totalTtc: Number(order.totalTtc),
        currency: order.currency,
      }),
    });
    if (sent) await prisma.orderEvent.create({ data: { orderId: order.id, type: "PAYMENT_CONFIRMATION_SENT", title: "Confirmation de paiement envoyée", description: `Email envoyé à ${order.customer.email}.`, metadata: { channel: "EMAIL", version: "V2.12.0" } } });
  } catch (error) {
    console.error("Stripe customer payment email failed", order.reference, error);
  }

  const internalEmail = process.env.ORDER_TO_EMAIL || process.env.CONTACT_TO_EMAIL;
  if (internalEmail && order.shippingAddress) {
    try {
      const sent = await sendOysteEmail({
        to: internalEmail,
        subject: `[OYSTE] Nouvelle commande payée ${order.reference} — ${order.customer.company || order.shippingAddress.company || "Client"}`,
        html: buildInternalNewOrderEmail({
          reference: order.reference,
          company: order.customer.company || order.shippingAddress.company || "Client",
          customerName: [order.customer.firstName, order.customer.lastName].filter(Boolean).join(" ") || order.customer.email,
          customerEmail: order.customer.email,
          paymentMethod: "CARD",
          totalTtc: Number(order.totalTtc),
          currency: order.currency,
          shippingAddress: order.shippingAddress,
        }),
      });
      if (sent) await prisma.orderEvent.create({ data: { orderId: order.id, type: "INTERNAL_ORDER_NOTIFICATION_SENT", title: "Notification interne envoyée", description: `Commande Stripe payée signalée à ${internalEmail}.`, metadata: { channel: "EMAIL" } } });
    } catch (error) {
      console.error("Stripe internal order notification failed", order.reference, error);
    }
  }

  // Only the process that actually moved the order to PAID launches the invoice chain.
  // Webhook/success-page races therefore cannot consume two invoice numbers or send
  // duplicate invoice emails. Any later invoice failure is logged and remains
  // recoverable step-by-step from the invoices back-office.
  const invoiceAutomation = await runStripeInvoiceAutomation(order.id);

  return {
    confirmed: true,
    newlyPaid: true,
    orderId: order.id,
    invoiceAutomation,
  };
}
