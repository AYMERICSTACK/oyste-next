import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentAdmin } from "@/lib/auth/admin-session";

const schema = z.object({
  confirmedLeadTime: z.string().trim().min(2).max(180),
  supplierAckReference: z.string().trim().max(120).optional().default(""),
  supplierName: z.string().trim().min(1).max(120).optional().default("Fournisseur"),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== "ACTIVE" || admin.role === "READ_ONLY") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Délai fournisseur invalide." }, { status: 400 });

  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, select: { id: true, reference: true } });
  if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });

  const event = await prisma.orderEvent.create({
    data: {
      orderId: id,
      type: "SUPPLIER_ACK_RECEIVED",
      title: "AR fournisseur reçu",
      description: `Délai confirmé : ${parsed.data.confirmedLeadTime}${parsed.data.supplierAckReference ? ` · AR ${parsed.data.supplierAckReference}` : ""}`,
      metadata: {
        ...parsed.data,
        adminId: admin.id,
        version: "V2.11.0",
      },
    },
  });

  return NextResponse.json({ saved: true, eventId: event.id });
}
