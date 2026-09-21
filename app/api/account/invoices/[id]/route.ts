import { getCurrentCustomer } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const customer = await getCurrentCustomer();
  if (!customer) return new Response("Non autorisé", { status: 401 });
  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({ where: { id, customerId: customer.id, publishedAt: { not: null } }, select: { filename: true, mimeType: true, pdfData: true } });
  if (!invoice || !invoice.pdfData || !invoice.filename || !invoice.mimeType) return new Response("Facture introuvable", { status: 404 });
  const safeName = invoice.filename.replace(/[\r\n"]/g, "_");
  return new Response(invoice.pdfData, { headers: { "Content-Type": invoice.mimeType, "Content-Disposition": `inline; filename="${safeName}"`, "Cache-Control": "private, no-store" } });
}
