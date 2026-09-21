import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== "ACTIVE") return new Response("Accès refusé", { status: 403 });

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { filename: true, mimeType: true, pdfData: true, number: true },
  });
  if (!invoice?.pdfData) return new Response("PDF de facture introuvable", { status: 404 });

  const filename = (invoice.filename || `${invoice.number || "facture"}.pdf`).replace(/[\r\n"]/g, "_");
  return new Response(invoice.pdfData, {
    headers: {
      "Content-Type": invoice.mimeType || "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
