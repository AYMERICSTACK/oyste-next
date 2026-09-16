/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db/prisma";
import { createSendcloudShipment, getSendcloudShippingOptions } from "@/lib/integrations/sendcloud";

const dimensionsSchema = z.object({
  weightKg: z.coerce.number().positive().max(1000),
  lengthCm: z.coerce.number().positive().max(300),
  widthCm: z.coerce.number().positive().max(300),
  heightCm: z.coerce.number().positive().max(300),
});
const createSchema = dimensionsSchema.extend({
  option: z.object({
    code: z.string().min(1), name: z.string().min(1), carrierCode: z.string().min(1), carrierName: z.string().min(1),
    contractId: z.number().int().nullable(), price: z.number().nullable(), currency: z.string().nullable(), leadTimeHours: z.number().nullable(),
  }),
});

async function getOrder(id: string) {
  return (prisma.order as any).findUnique({
    where: { id },
    include: { customer: true, shippingAddress: true, shipment: true },
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== "ACTIVE") return NextResponse.json({ message: "Non autorisé." }, { status: 401 });
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ message: "Commande introuvable." }, { status: 404 });
  if (order.shipment) return NextResponse.json({ shipment: order.shipment, options: [] });
  if (!order.shippingAddress) return NextResponse.json({ message: "Adresse de livraison manquante." }, { status: 400 });
  const url = new URL(request.url);
  const parsed = dimensionsSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ message: "Poids ou dimensions invalides." }, { status: 400 });
  try {
    const options = await getSendcloudShippingOptions({ ...parsed.data, toCountry: order.shippingAddress.country, toPostalCode: order.shippingAddress.postalCode });
    return NextResponse.json({ options, shipment: null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Impossible de récupérer les services Sendcloud." }, { status: 502 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== "ACTIVE" || admin.role === "READ_ONLY") return NextResponse.json({ message: "Accès refusé." }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Données d’expédition invalides." }, { status: 400 });
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ message: "Commande introuvable." }, { status: 404 });
  if (order.shipment) return NextResponse.json({ message: "Une expédition existe déjà pour cette commande." }, { status: 409 });
  if (!order.shippingAddress) return NextResponse.json({ message: "Adresse de livraison manquante." }, { status: 400 });
  const address = order.shippingAddress;
  try {
    const remote = await createSendcloudShipment({
      orderReference: order.reference,
      totalTtc: Number(order.totalTtc),
      recipient: {
        name: [address.firstName || order.customer.firstName, address.lastName || order.customer.lastName].filter(Boolean).join(" ") || order.customer.email,
        company: address.company || order.customer.company || "",
        address1: address.address1, address2: address.address2, postalCode: address.postalCode, city: address.city,
        country: address.country, phone: order.customer.phone || "", email: order.customer.email,
      },
      ...parsed.data,
    });
    const shipment = await prisma.$transaction(async (tx) => {
      const db = tx as any;
      const created = await db.shipment.create({ data: {
        orderId: order.id, ...remote,
        carrierCode: parsed.data.option.carrierCode, carrierName: parsed.data.option.carrierName,
        shippingOptionCode: parsed.data.option.code, shippingOptionName: parsed.data.option.name,
        weightKg: parsed.data.weightKg, lengthCm: parsed.data.lengthCm, widthCm: parsed.data.widthCm, heightCm: parsed.data.heightCm,
      }});
      await db.order.update({ where: { id: order.id }, data: {
        status: "SHIPPED", shippedAt: new Date(),
        events: { create: { type: "SHIPMENT_CREATED", title: "Étiquette Sendcloud créée", description: `${parsed.data.option.carrierName} · ${remote.trackingNumber || "suivi en attente"}`, metadata: { adminId: admin.id, shipmentId: created.id } } },
      }});
      return created;
    });
    return NextResponse.json({ shipment }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "La création Sendcloud a échoué." }, { status: 502 });
  }
}
