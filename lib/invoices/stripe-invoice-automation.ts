import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { sendOysteEmail } from "@/lib/email/resend";
import { buildInvoiceAvailableEmail } from "@/lib/orders/order-email";
import { generateInvoicePdf } from "@/lib/invoices/invoice-pdf";
import {
  createInvoiceDraftFromPaidOrder,
  issueInvoiceDraft,
} from "@/lib/invoices/invoice-service";

type AutomationStage =
  | "draft"
  | "issue"
  | "pdf"
  | "publish"
  | "notify"
  | "complete";

function publicBaseUrl() {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "";

  if (configured) return configured.replace(/\/$/, "");

  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    "";

  if (vercelHost) {
    return `${vercelHost.startsWith("http") ? "" : "https://"}${vercelHost}`.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}

async function recordOrderEvent(input: {
  orderId: string;
  type: string;
  title: string;
  description?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  try {
    await prisma.orderEvent.create({
      data: {
        orderId: input.orderId,
        type: input.type,
        title: input.title,
        description: input.description,
        metadata: input.metadata,
      },
    });
  } catch (error) {
    console.error("Invoice automation event logging failed", input.type, error);
  }
}

async function ensurePdf(invoiceId: string) {
  const current = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      number: true,
      status: true,
      filename: true,
      size: true,
      pdfData: true,
      orderId: true,
    },
  });

  if (!current) throw new Error("Facture introuvable.");
  if (current.filename && current.size && current.pdfData) {
    return { generated: false as const, invoice: current };
  }

  const generated = await generateInvoicePdf(invoiceId);
  const pdf = Buffer.from(generated.bytes);
  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      filename: generated.filename,
      mimeType: "application/pdf",
      size: pdf.length,
      pdfData: pdf,
    },
    select: {
      id: true,
      number: true,
      status: true,
      filename: true,
      size: true,
      pdfData: true,
      orderId: true,
    },
  });

  await recordOrderEvent({
    orderId: updated.orderId,
    type: "INVOICE_PDF_GENERATED",
    title: "PDF de facture généré automatiquement",
    description: `Le PDF ${updated.filename} a été généré après confirmation du paiement Stripe.`,
    metadata: {
      invoiceId: updated.id,
      source: "STRIPE",
      version: "V2.16.0",
    },
  });

  return { generated: true as const, invoice: updated };
}

async function ensurePublished(invoiceId: string) {
  const current = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      number: true,
      status: true,
      filename: true,
      pdfData: true,
      publishedAt: true,
      orderId: true,
    },
  });

  if (!current) throw new Error("Facture introuvable.");
  if (current.status !== "ISSUED" || !current.number) {
    throw new Error("La facture doit être émise avant publication.");
  }
  if (!current.filename || !current.pdfData) {
    throw new Error("Le PDF doit être généré avant publication.");
  }
  if (current.publishedAt) {
    return { published: false as const, invoice: current };
  }

  const publishedAt = new Date();
  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { publishedAt },
    select: {
      id: true,
      number: true,
      status: true,
      filename: true,
      pdfData: true,
      publishedAt: true,
      orderId: true,
    },
  });

  await recordOrderEvent({
    orderId: updated.orderId,
    type: "INVOICE_PUBLISHED",
    title: "Facture publiée automatiquement dans l’espace client",
    description: `La facture ${updated.number} est disponible dans l’espace client après paiement Stripe.`,
    metadata: {
      invoiceId: updated.id,
      source: "STRIPE",
      version: "V2.16.0",
    },
  });

  return { published: true as const, invoice: updated };
}

async function ensureNotified(invoiceId: string) {
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
  if (!invoice.publishedAt) {
    throw new Error("La facture doit être publiée avant notification.");
  }
  if (invoice.notifiedAt) {
    return { notified: false as const, invoice };
  }

  const sent = await sendOysteEmail({
    to: invoice.customer.email,
    subject: `OYSTE — Votre facture ${invoice.number || ""} est disponible`,
    html: buildInvoiceAvailableEmail({
      firstName: invoice.customer.firstName,
      reference: invoice.order.reference,
      invoiceNumber: invoice.number,
      accountUrl: `${publicBaseUrl()}/compte/factures`,
    }),
  });

  if (!sent) {
    throw new Error("L’email de mise à disposition de la facture n’a pas pu être envoyé.");
  }

  const notifiedAt = new Date();
  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: { notifiedAt },
    select: {
      id: true,
      number: true,
      publishedAt: true,
      notifiedAt: true,
      orderId: true,
    },
  });

  await recordOrderEvent({
    orderId: updated.orderId,
    type: "INVOICE_NOTIFICATION_SENT",
    title: "Notification facture envoyée automatiquement",
    description: `Email de mise à disposition de la facture ${updated.number} envoyé à ${invoice.customer.email}.`,
    metadata: {
      invoiceId: updated.id,
      source: "STRIPE",
      version: "V2.16.0",
    },
  });

  return { notified: true as const, invoice: updated };
}

/**
 * Completes the Stripe invoice workflow after a card payment has just become PAID.
 *
 * The caller must only invoke this for the process that won the PAID transition.
 * Every individual step remains recoverable from the invoices back-office:
 * draft -> issue -> PDF -> publish -> email.
 *
 * Errors are intentionally swallowed after being logged so an accounting/PDF/email
 * failure can never roll back or invalidate a successfully confirmed Stripe payment.
 */
export async function runStripeInvoiceAutomation(orderId: string) {
  let stage: AutomationStage = "draft";
  let invoiceId: string | null = null;

  try {
    const draft = await createInvoiceDraftFromPaidOrder(orderId);
    invoiceId = draft.invoice.id;

    if (draft.created) {
      await recordOrderEvent({
        orderId,
        type: "INVOICE_DRAFT_CREATED",
        title: "Brouillon de facture créé automatiquement",
        description: "Le brouillon comptable OYSTE a été créé après confirmation du paiement Stripe.",
        metadata: {
          invoiceId,
          source: "STRIPE",
          version: "V2.16.0",
        },
      });
    }

    stage = "issue";
    const issued = await issueInvoiceDraft(invoiceId);

    if (issued.issued) {
      await recordOrderEvent({
        orderId,
        type: "INVOICE_ISSUED",
        title: "Facture émise automatiquement",
        description: `La facture ${issued.invoice.number} a été émise après paiement Stripe.`,
        metadata: {
          invoiceId,
          invoiceNumber: issued.invoice.number,
          source: "STRIPE",
          version: "V2.16.0",
        },
      });
    }

    stage = "pdf";
    const pdf = await ensurePdf(invoiceId);

    stage = "publish";
    const publication = await ensurePublished(invoiceId);

    stage = "notify";
    const notification = await ensureNotified(invoiceId);

    stage = "complete";
    const finalInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        number: true,
        status: true,
        filename: true,
        publishedAt: true,
        notifiedAt: true,
      },
    });

    await recordOrderEvent({
      orderId,
      type: "INVOICE_AUTOMATION_COMPLETED",
      title: "Facturation Stripe automatisée terminée",
      description: finalInvoice?.number
        ? `La facture ${finalInvoice.number} a été émise, publiée et notifiée automatiquement.`
        : "Le parcours de facturation Stripe automatisé est terminé.",
      metadata: {
        invoiceId,
        invoiceNumber: finalInvoice?.number ?? null,
        pdfGenerated: pdf.generated,
        published: publication.published,
        notified: notification.notified,
        source: "STRIPE",
        version: "V2.16.0",
      },
    });

    return {
      ok: true as const,
      invoice: finalInvoice,
      pdfGenerated: pdf.generated,
      published: publication.published,
      notified: notification.notified,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue de facturation automatique.";
    console.error("Stripe invoice automation failed", { orderId, invoiceId, stage, error });

    await recordOrderEvent({
      orderId,
      type: "INVOICE_AUTOMATION_FAILED",
      title: "Facturation Stripe automatique à reprendre",
      description: `Étape ${stage} en échec : ${message}`,
      metadata: {
        invoiceId,
        stage,
        source: "STRIPE",
        version: "V2.16.0",
      },
    });

    return {
      ok: false as const,
      invoiceId,
      stage,
      error: message,
    };
  }
}
