import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { sendOysteEmail } from "@/lib/email/resend";
import { buildInvoiceAvailableEmail } from "@/lib/orders/order-email";
import { createInvoiceDraftFromPaidOrder, issueInvoiceDraft } from "@/lib/invoices/invoice-service";
import { generateInvoicePdf } from "@/lib/invoices/invoice-pdf";

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
      id: true,
      reference: true,
      totalTtc: true,
      currency: true,
      createdAt: true,
      paymentStatus: true,
      customer: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          company: true,
        },
      },
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
  const scored = orders
    .map((order) => {
      let score = 0;
      const reasons: string[] = [];
      if (searchable.includes(normalize(order.reference))) {
        score += 100;
        reasons.push("Référence commande détectée");
      }
      if (searchable.includes(normalize(order.customer.email))) {
        score += 35;
        reasons.push("Email client détecté");
      }
      if (order.customer.company && searchable.includes(normalize(order.customer.company))) {
        score += 20;
        reasons.push("Société détectée");
      }
      return { order, score, reasons };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
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
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        sourceKey: true,
        number: true,
        type: true,
        status: true,
        issuedAt: true,
        filename: true,
        size: true,
        publishedAt: true,
        notifiedAt: true,
        createdAt: true,
        totalTtc: true,
        orderId: true,
        order: { select: { reference: true } },
        customer: { select: { email: true, company: true } },
      },
    }),
  ]);

  const automaticByOrderId = new Map(
    invoices
      .filter((invoice) => invoice.sourceKey?.startsWith("ORDER:"))
      .map((invoice) => [invoice.orderId, invoice]),
  );

  const automationOrders = orders
    .filter((order) => order.paymentStatus === "PAID")
    .slice(0, 40)
    .map((order) => {
      const invoice = automaticByOrderId.get(order.id);
      return {
        ...order,
        invoice: invoice
          ? {
              id: invoice.id,
              number: invoice.number,
              status: invoice.status,
              issuedAt: invoice.issuedAt,
              pdfReady: Boolean(invoice.filename && invoice.size),
              filename: invoice.filename,
              publishedAt: invoice.publishedAt,
              notifiedAt: invoice.notifiedAt,
            }
          : null,
      };
    });

  return NextResponse.json({
    version: "V2.15.0",
    orders,
    automationOrders,
    invoices: invoices.map((invoice) => ({
      ...invoice,
      pdfReady: Boolean(invoice.filename && invoice.size),
    })),
  });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(true);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const adminId = admin.id;

  const form = await request.formData();
  const action = String(form.get("action") || "recognize");

  if (action === "auto-create") {
    const orderId = String(form.get("orderId") || "");
    if (!orderId) return NextResponse.json({ error: "Commande manquante." }, { status: 400 });
    const result = await createInvoiceDraftFromPaidOrder(orderId);
    return NextResponse.json({
      ok: true,
      created: result.created,
      invoiceId: result.invoice.id,
      status: result.invoice.status,
      number: result.invoice.number,
    });
  }

  if (action === "auto-issue") {
    const invoiceId = String(form.get("invoiceId") || "");
    if (!invoiceId) return NextResponse.json({ error: "Facture manquante." }, { status: 400 });
    const result = await issueInvoiceDraft(invoiceId);
    return NextResponse.json({
      ok: true,
      issued: result.issued,
      invoiceId: result.invoice.id,
      status: result.invoice.status,
      number: result.invoice.number,
      issuedAt: result.invoice.issuedAt,
    });
  }

  async function notifyInvoice(invoiceId: string, origin: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        number: true,
        publishedAt: true,
        notifiedAt: true,
        orderId: true,
        order: { select: { reference: true } },
        customer: { select: { email: true, firstName: true } },
      },
    });
    if (!invoice) throw new Error("Facture introuvable.");
    if (!invoice.publishedAt) throw new Error("La facture doit être publiée avant notification.");
    if (invoice.notifiedAt) return { sent: false, alreadyNotified: true, invoice };

    const sent = await sendOysteEmail({
      to: invoice.customer.email,
      subject: `OYSTE — Votre facture ${invoice.number || ""} est disponible`,
      html: buildInvoiceAvailableEmail({
        firstName: invoice.customer.firstName,
        reference: invoice.order.reference,
        invoiceNumber: invoice.number,
        accountUrl: `${origin}/compte/factures`,
      }),
    });

    if (!sent) return { sent: false, alreadyNotified: false, invoice };

    const notifiedAt = new Date();
    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { notifiedAt },
      select: { id: true, number: true, notifiedAt: true, orderId: true },
    });
    await prisma.orderEvent.create({
      data: {
        orderId: updated.orderId,
        type: "INVOICE_NOTIFICATION_SENT",
        title: "Notification facture envoyée",
        description: `Email de mise à disposition de la facture ${updated.number} envoyé à ${invoice.customer.email}.`,
        metadata: { invoiceId: updated.id, adminId: adminId, version: "V2.15.0" },
      },
    });
    return { sent: true, alreadyNotified: false, invoice: { ...invoice, notifiedAt } };
  }

  if (action === "auto-publish") {
    const invoiceId = String(form.get("invoiceId") || "");
    if (!invoiceId) return NextResponse.json({ error: "Facture manquante." }, { status: 400 });

    const current = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, number: true, status: true, filename: true, pdfData: true, publishedAt: true, notifiedAt: true, orderId: true },
    });
    if (!current) return NextResponse.json({ error: "Facture introuvable." }, { status: 404 });
    if (current.status !== "ISSUED" || !current.number) {
      return NextResponse.json({ error: "La facture doit être émise avant publication." }, { status: 409 });
    }
    if (!current.filename || !current.pdfData) {
      return NextResponse.json({ error: "Générez le PDF avant de publier la facture." }, { status: 409 });
    }

    let publishedAt = current.publishedAt;
    let published = false;
    if (!publishedAt) {
      publishedAt = new Date();
      await prisma.invoice.update({ where: { id: invoiceId }, data: { publishedAt } });
      published = true;
      await prisma.orderEvent.create({
        data: {
          orderId: current.orderId,
          type: "INVOICE_PUBLISHED",
          title: "Facture publiée dans l’espace client",
          description: `La facture ${current.number} est disponible dans l’espace client.`,
          metadata: { invoiceId: current.id, adminId: adminId, version: "V2.15.0" },
        },
      });
    }

    const notification = await notifyInvoice(invoiceId, new URL(request.url).origin);
    return NextResponse.json({
      ok: true,
      published,
      alreadyPublished: !published,
      invoiceId: current.id,
      number: current.number,
      publishedAt,
      emailSent: notification.sent,
      alreadyNotified: notification.alreadyNotified,
    });
  }

  if (action === "auto-notify") {
    const invoiceId = String(form.get("invoiceId") || "");
    if (!invoiceId) return NextResponse.json({ error: "Facture manquante." }, { status: 400 });
    try {
      const notification = await notifyInvoice(invoiceId, new URL(request.url).origin);
      return NextResponse.json({
        ok: true,
        invoiceId,
        number: notification.invoice.number,
        emailSent: notification.sent,
        alreadyNotified: notification.alreadyNotified,
        notifiedAt: notification.invoice.notifiedAt,
      });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Notification impossible." }, { status: 409 });
    }
  }

  if (action === "auto-generate-pdf") {
    const invoiceId = String(form.get("invoiceId") || "");
    if (!invoiceId) return NextResponse.json({ error: "Facture manquante." }, { status: 400 });

    const generated = await generateInvoicePdf(invoiceId);
    const pdf = Buffer.from(generated.bytes);
    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        filename: generated.filename,
        mimeType: "application/pdf",
        size: pdf.length,
        pdfData: pdf,
      },
      select: { id: true, number: true, filename: true, size: true, orderId: true },
    });

    await prisma.orderEvent.create({
      data: {
        orderId: invoice.orderId,
        type: "INVOICE_PDF_GENERATED",
        title: "PDF de facture généré",
        description: `Le PDF ${invoice.filename} a été généré dans le back-office.`,
        metadata: { invoiceId: invoice.id, adminId: adminId, version: "V2.13.0" },
      },
    });

    return NextResponse.json({
      ok: true,
      invoiceId: invoice.id,
      number: invoice.number,
      filename: invoice.filename,
      size: invoice.size,
      published: false,
    });
  }

  const file = form.get("file");
  if (!(file instanceof File) || !safeFile(file)) {
    return NextResponse.json({ error: "PDF invalide ou supérieur à 12 Mo." }, { status: 400 });
  }

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
      number,
      filename: file.name,
      mimeType: "application/pdf",
      size: file.size,
      pdfData: bytes,
      publishedAt: new Date(),
      orderId: order.id,
      customerId: order.customerId,
      uploadedById: adminId,
    },
    select: { id: true, number: true, filename: true },
  });
  await prisma.orderEvent.create({
    data: {
      orderId: order.id,
      type: "INVOICE_AVAILABLE",
      title: "Facture disponible",
      description: `${number ? `Facture ${number}` : file.name} ajoutée à l’espace client.`,
      metadata: { invoiceId: invoice.id, filename: file.name, adminId: adminId, version: "V2.13.0" },
    },
  });

  const origin = new URL(request.url).origin;
  const sent = await sendOysteEmail({
    to: order.customer.email,
    subject: `OYSTE — Votre facture est disponible · ${order.reference}`,
    html: buildInvoiceAvailableEmail({
      firstName: order.customer.firstName,
      reference: order.reference,
      invoiceNumber: number,
      accountUrl: `${origin}/compte/factures`,
    }),
  });
  if (sent) {
    await prisma.invoice.update({ where: { id: invoice.id }, data: { notifiedAt: new Date() } });
    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "INVOICE_NOTIFICATION_SENT",
        title: "Notification facture envoyée",
        description: `Email envoyé à ${order.customer.email}.`,
        metadata: { invoiceId: invoice.id, adminId: adminId, version: "V2.13.0" },
      },
    });
  }

  return NextResponse.json({
    saved: true,
    invoiceId: invoice.id,
    emailSent: sent,
    orderReference: order.reference,
    customerEmail: order.customer.email,
  });
}
