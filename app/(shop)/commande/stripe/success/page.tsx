import { notFound, redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { retrieveStripeCheckoutSession } from "@/lib/integrations/stripe";
import { confirmPaidStripeOrder } from "@/lib/orders/stripe-payment";

export const dynamic = "force-dynamic";

export default async function StripeSuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/connexion?redirect=/compte/commandes");
  const { session_id: sessionId } = await searchParams;
  if (!sessionId) notFound();

  const session = await retrieveStripeCheckoutSession(sessionId);
  const orderId = session.metadata?.orderId || session.client_reference_id;
  if (!orderId || session.metadata?.customerId !== customer.id) notFound();
  // Prisma sera régénéré après la migration Stripe.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = await (prisma.order as any).findFirst({ where: { id: orderId, customerId: customer.id, stripeCheckoutSessionId: sessionId }, include: { customer: true } });
  if (!order) notFound();

  if (session.payment_status === "paid") await confirmPaidStripeOrder(session);

  redirect(`/commande/confirmation/${order.id}?paid=1`);
}
