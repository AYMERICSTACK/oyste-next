/* eslint-disable @typescript-eslint/no-explicit-any */
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db/prisma";
import { downloadSendcloudDocument } from "@/lib/integrations/sendcloud";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== "ACTIVE") return new Response("Non autorisé", { status: 401 });
  const { id } = await params;
  const shipment = await (prisma as any).shipment.findUnique({ where: { id } });
  if (!shipment?.labelUrl) return new Response("Étiquette indisponible", { status: 404 });
  try {
    const response = await downloadSendcloudDocument(shipment.labelUrl);
    return new Response(response.body, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="etiquette-${shipment.orderId}.pdf"`, "Cache-Control": "private, no-store" } });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Erreur Sendcloud", { status: 502 });
  }
}
