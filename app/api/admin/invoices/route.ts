import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { sendOysteEmail } from "@/lib/email/resend";
import { buildInvoiceAvailableEmail } from "@/lib/orders/order-email";

export const runtime = "nodejs";
const MAX_PDF_SIZE = 12 * 1024 * 1024;

async function requireAdmin(write = false) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== "ACTIVE") return null;
  if (write && admin.role === "READ_ONLY") return null;
  return admin;
}

async function recentOrders() {
  return prisma.order.findMany({
    where: { status: { not: "CANCELLED" } },
    orderBy: { createdAt: "desc" },
    take: 250,
    select: {
      id: true, reference: true, totalTtc: true, currency: true, createdAt: true, paymentStatus: true,
      customer: { select: { id: true, email: true, firstName: true, lastName: true, company: true } },
      _count: { select: { invoices: true } },
    },
  });
}

function safeFile(file: File) {
  return file.type === "application/pdf" && file.size > 0 && file.size <= MAX_PDF_SIZE;
}

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function invoiceNumberFromName(filename: string) {
  const clean = filename.replace(/\.pdf$/i, "");
  const match = clean.match(/(?:facture|invoice|fa)[-_\s]*([a-z0-9][a-z0-9._-]{2,})/i);
  return match?.[1] || "";
}

async function recognize(file: File) {
  const orders = await recentOrders();
  const bytes = Buffer.from(await file.arrayBuffer());
  const searchable = normalize(`${file.name}\n${bytes.toString("latin1")}`);
  const scored = orders.map((order) => {
    let score = 0;
    const reasons: string[] = [];
    if (searchable.includes(normalize(order.reference))) { score += 100; reasons.push("Référence commande détectée"); }
    if (searchable.includes(normalize(order.customer.email))) { score += 35; reasons.push("Email client détecté"); }
    if (order.customer.company && searchable.includes(normalize(order.customer.company))) { score += 20; reasons.push("Société détectée"); }
    return { order, score, reasons };
  }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);
  const best = scored[0] || null;
  const ambiguous = Boolean(best && scored[1] && scored[1].score === best.score);
  return {
    filename: file.name,
    size: file.size,
    invoiceNumberSuggestion: invoiceNumberFromName(file.name),
    match: best && !ambiguous ? { ...best.order, score: best.score, reasons: best.reasons } : null,
    ambiguous,
    alternatives: scored.slice(0, 5).map((entry) => ({ ...entry.order, score: entry.score, reasons: entry.reasons })),
    orders,
  };
}

export async function GET() {
  const admin = await requireAdmin(false);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const [orders, invoices] = await Promise.all([
    recentOrders(),
    prisma.invoice.findMany({
      orderBy: { createdAt: "desc" }, take: 60,
      select: { id: true, number: true, filename: true, size: true, notifiedAt: true, createdAt: true, order: { select: { reference: true } }, customer: { select: { email: true, company: true } } },
    }),
  ]);
  return NextResponse.json({ version: "V2.12.0", orders, invoices });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(true);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const form = await request.formData();
  const action = String(form.get("action") || "recognize");
  const file = form.get("file");
  if (!(file instanceof File) || !safeFile(file)) return NextResponse.json({ error: "PDF invalide ou supérieur à 12 Mo." }, { status: 400 });

  if (action === "recognize") return NextResponse.json(await recognize(file));
  if (action !== "confirm") return NextResponse.json({ error: "Action inconnue." }, { status: 400 });

  const orderId = String(form.get("orderId") || "");
  const number = String(form.get("invoiceNumber") || "").trim().slice(0, 120) || null;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true },
  });
  if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const invoice = await prisma.invoice.create({
    data: {
      number, filename: file.name, mimeType: "application/pdf", size: file.size,
      pdfData: bytes, orderId: order.id, customerId: order.customerId, uploadedById: admin.id,
    },
    select: { id: true, number: true, filename: true },
  });
  await prisma.orderEvent.create({ data: {
    orderId: order.id, type: "INVOICE_AVAILABLE", title: "Facture disponible",
    description: `${number ? `Facture ${number}` : file.name} ajoutée à l’espace client.`,
    metadata: { invoiceId: invoice.id, filename: file.name, adminId: admin.id, version: "V2.12.0" },
  }});

  const origin = new URL(request.url).origin;
  const sent = await sendOysteEmail({
    to: order.customer.email,
    subject: `OYSTE — Votre facture est disponible · ${order.reference}`,
    html: buildInvoiceAvailableEmail({ firstName: order.customer.firstName, reference: order.reference, invoiceNumber: number, accountUrl: `${origin}/compte/factures` }),
  });
  if (sent) {
    await prisma.invoice.update({ where: { id: invoice.id }, data: { notifiedAt: new Date() } });
    await prisma.orderEvent.create({ data: { orderId: order.id, type: "INVOICE_NOTIFICATION_SENT", title: "Notification facture envoyée", description: `Email envoyé à ${order.customer.email}.`, metadata: { invoiceId: invoice.id, adminId: admin.id, version: "V2.12.0" } } });
  }

  return NextResponse.json({ saved: true, invoiceId: invoice.id, emailSent: sent, orderReference: order.reference, customerEmail: order.customer.email });
}
