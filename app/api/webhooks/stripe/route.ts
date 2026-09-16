import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { confirmPaidStripeOrder } from "@/lib/orders/stripe-payment";
import type { StripeCheckoutSession } from "@/lib/integrations/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOLERANCE_SECONDS = 300;

function validSignature(payload: string, header: string, secret: string) {
  const parts = header.split(",");
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return signatures.some((signature) => {
    try {
      const received = Buffer.from(signature, "hex");
      return received.length === expectedBuffer.length && timingSafeEqual(received, expectedBuffer);
    } catch {
      return false;
    }
  });
}

type StripeEvent = { type?: string; data?: { object?: StripeCheckoutSession } };

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) return NextResponse.json({ message: "Webhook Stripe non configuré." }, { status: 503 });

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") || "";
  if (!validSignature(payload, signature, secret)) return NextResponse.json({ message: "Signature Stripe invalide." }, { status: 400 });

  let event: StripeEvent;
  try { event = JSON.parse(payload) as StripeEvent; }
  catch { return NextResponse.json({ message: "Payload Stripe invalide." }, { status: 400 }); }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data?.object;
    if (session?.id) await confirmPaidStripeOrder(session);
  }

  return NextResponse.json({ received: true });
}
