import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db/prisma";
const schema = z.object({ status: z.enum(["pending-payment","paid","engineering","production","quality-control","ready-to-ship","shipped","completed","cancelled"]).optional(), paymentReceived: z.boolean().optional() });
const statusMap = { "pending-payment":"PENDING_PAYMENT", paid:"PAID", engineering:"ENGINEERING", production:"PRODUCTION", "quality-control":"QUALITY_CONTROL", "ready-to-ship":"READY_TO_SHIP", shipped:"SHIPPED", completed:"COMPLETED", cancelled:"CANCELLED" } as const;
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin(); if (!admin || admin.status !== "ACTIVE" || admin.role === "READ_ONLY") return NextResponse.json({ message: "Accès refusé." }, { status: 403 });
  const parsed = schema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ message: "Données invalides." }, { status: 400 });
  const { id } = await params; const data: any = {};
  if (parsed.data.status) data.status = statusMap[parsed.data.status];
  if (parsed.data.paymentReceived) { data.paymentStatus = "PAID"; data.paidAt = new Date(); if (!parsed.data.status || parsed.data.status === "pending-payment") data.status = "PAID"; }
  const order = await (prisma.order as any).update({ where: { id }, data: { ...data, events: { create: { type: parsed.data.paymentReceived ? "PAYMENT_RECEIVED" : "STATUS_UPDATED", title: parsed.data.paymentReceived ? "Virement reçu" : "Statut mis à jour", description: parsed.data.paymentReceived ? "Le règlement bancaire a été confirmé par l’administration." : `Nouveau statut : ${parsed.data.status}.`, metadata: { adminId: admin.id } } } } });
  return NextResponse.json({ id: order.id });
}
