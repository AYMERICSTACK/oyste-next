import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentAdmin } from "@/lib/auth/admin-session";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== "ACTIVE" || admin.role === "READ_ONLY") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      events: { where: { type: "SUPPLIER_ACK_RECEIVED" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  if (!order.events.length) {
    return NextResponse.json({ error: "Enregistrez d’abord l’AR fournisseur et le délai confirmé." }, { status: 409 });
  }

  await prisma.orderEvent.create({
    data: {
      orderId: id,
      type: "CUSTOMER_ACK_GENERATED",
      title: "AR client généré",
      description: "La confirmation de commande client a été générée à partir du délai fournisseur confirmé.",
      metadata: { adminId: admin.id, version: "V2.11.0" },
    },
  });

  return NextResponse.json({ generated: true, url: `/admin/commandes/${encodeURIComponent(id)}/ar` });
}
