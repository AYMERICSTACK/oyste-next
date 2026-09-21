import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function sellerSnapshot() {
  return {
    sellerName: process.env.INVOICE_SELLER_NAME?.trim() || "ADEI",
    sellerBrand: process.env.INVOICE_SELLER_BRAND?.trim() || "OYSTE",
    sellerSiren: process.env.INVOICE_SELLER_SIREN?.trim() || "330897042",
    sellerSiret: process.env.INVOICE_SELLER_SIRET?.trim() || null,
    sellerVatNumber: process.env.INVOICE_SELLER_VAT_NUMBER?.trim() || null,
    sellerAddress1: process.env.INVOICE_SELLER_ADDRESS1?.trim() || null,
    sellerAddress2: process.env.INVOICE_SELLER_ADDRESS2?.trim() || null,
    sellerPostalCode: process.env.INVOICE_SELLER_POSTAL_CODE?.trim() || null,
    sellerCity: process.env.INVOICE_SELLER_CITY?.trim() || null,
    sellerCountry: process.env.INVOICE_SELLER_COUNTRY?.trim() || "FR",
  };
}

/**
 * Creates the immutable accounting snapshot for a paid order.
 * No number, PDF, email or e-invoice transmission is produced here.
 * sourceKey makes retries idempotent without preventing future credit notes.
 */
export async function createInvoiceDraftFromPaidOrder(orderId: string) {
  const sourceKey = `ORDER:${orderId}:INVOICE`;
  const existing = await prisma.invoice.findUnique({ where: { sourceKey }, include: { lines: true } });
  if (existing) return { invoice: existing, created: false as const };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { include: { addresses: true } },
      items: { orderBy: { id: "asc" } },
    },
  });
  if (!order) throw new Error("Commande introuvable.");
  if (order.paymentStatus !== "PAID" || !order.paidAt) throw new Error("La facture ne peut être préparée qu'après validation du paiement.");

  const billing = order.customer.addresses.find((address) => address.type === "BILLING") || null;
  const subtotalHt = Number(order.subtotalHt);
  const taxAmount = Number(order.taxAmount);
  const totalTtc = Number(order.totalTtc);
  const taxableHt = totalTtc - taxAmount;
  const shippingHt = money(taxableHt - subtotalHt);
  const vatRate = taxableHt !== 0 ? money((taxAmount / taxableHt) * 100) : 0;

  const lines = order.items.map((item, index) => {
    const lineHt = Number(item.totalHt);
    const lineTax = money(lineHt * vatRate / 100);
    return {
      sortOrder: index,
      name: item.name,
      reference: item.reference,
      quantity: item.quantity,
      unitPriceHt: item.unitPriceHt,
      totalHt: item.totalHt,
      vatRate,
      taxAmount: lineTax,
      totalTtc: money(lineHt + lineTax),
      configuration: item.configuration ?? undefined,
    };
  });

  if (Math.abs(shippingHt) >= 0.01) {
    const shippingTax = money(shippingHt * vatRate / 100);
    lines.push({
      sortOrder: lines.length,
      name: "Transport",
      reference: "TRANSPORT",
      quantity: 1,
      unitPriceHt: new Prisma.Decimal(shippingHt),
      totalHt: new Prisma.Decimal(shippingHt),
      vatRate,
      taxAmount: shippingTax,
      totalTtc: money(shippingHt + shippingTax),
      configuration: undefined,
    });
  }

  // The invoice totals must be the exact sum of its immutable invoice lines.
  // This includes shipping, while Order.subtotalHt currently only contains product lines.
  const invoiceSubtotalHt = lines.reduce(
    (sum, line) => sum.plus(line.totalHt),
    new Prisma.Decimal(0),
  );
  const invoiceTaxAmount = lines.reduce(
    (sum, line) => sum.plus(line.taxAmount),
    new Prisma.Decimal(0),
  );
  const invoiceTotalTtc = lines.reduce(
    (sum, line) => sum.plus(line.totalTtc),
    new Prisma.Decimal(0),
  );

  try {
    const invoice = await prisma.invoice.create({
      data: {
        sourceKey,
        type: "INVOICE",
        status: "DRAFT",
        ...sellerSnapshot(),
        buyerEmail: order.customer.email,
        buyerFirstName: order.customer.firstName,
        buyerLastName: order.customer.lastName,
        buyerCompany: order.customer.company,
        buyerSiren: order.customer.siren,
        buyerSiret: order.customer.siret,
        buyerVatNumber: order.customer.vatNumber,
        buyerAddress1: billing?.address1 || null,
        buyerAddress2: billing?.address2 || null,
        buyerPostalCode: billing?.postalCode || null,
        buyerCity: billing?.city || null,
        buyerCountry: billing?.country || null,
        buyerElectronicAddress: order.customer.electronicBillingAddress,
        currency: order.currency,
        subtotalHt: invoiceSubtotalHt,
        taxAmount: invoiceTaxAmount,
        totalTtc: invoiceTotalTtc,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        paymentReference: order.paymentReference,
        paidAt: order.paidAt,
        orderId: order.id,
        customerId: order.customerId,
        lines: { create: lines },
      },
      include: { lines: true },
    });
    return { invoice, created: true as const };
  } catch (error) {
    // A concurrent webhook/retry may have won the unique sourceKey race.
    const raced = await prisma.invoice.findUnique({ where: { sourceKey }, include: { lines: true } });
    if (raced) return { invoice: raced, created: false as const };
    throw error;
  }
}

function invoiceYearInFrance(date: Date) {
  const year = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    year: "numeric",
  }).format(date);
  return Number(year);
}

function formatInvoiceNumber(year: number, sequence: number) {
  return `OYS-${year}-${String(sequence).padStart(6, "0")}`;
}

/**
 * Atomically issues an existing invoice draft.
 *
 * - Locks the invoice row first, so concurrent retries for the same invoice cannot
 *   consume two sequence numbers.
 * - Uses a yearly sequence row with an atomic increment, so two different invoices
 *   cannot receive the same number.
 * - Once issued, retries are idempotent and return the existing issued invoice.
 *
 * PDF generation / email / e-invoice delivery stay deliberately outside this step.
 */
export async function issueInvoiceDraft(invoiceId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} FOR UPDATE`,
    );

    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });

    if (!invoice) throw new Error("Facture introuvable.");

    if (invoice.status === "ISSUED" && invoice.number) {
      return { invoice, issued: false as const };
    }

    if (invoice.status !== "DRAFT") {
      throw new Error("Seule une facture brouillon peut être émise.");
    }

    if (invoice.number) {
      throw new Error("Ce brouillon possède déjà un numéro de facture inattendu.");
    }

    if (!invoice.lines.length) {
      throw new Error("Impossible d'émettre une facture sans ligne.");
    }

    // Recovery path for legacy drafts created before the seller environment
    // variables were configured in production. A DRAFT has not been issued yet,
    // so it is still safe to refresh its seller snapshot before consuming a number.
    const sellerIdentityIncomplete =
      !invoice.sellerName ||
      !invoice.sellerSiren ||
      !invoice.sellerSiret ||
      !invoice.sellerVatNumber ||
      !invoice.sellerAddress1 ||
      !invoice.sellerPostalCode ||
      !invoice.sellerCity ||
      !invoice.sellerCountry;

    let invoiceToIssue = invoice;
    if (sellerIdentityIncomplete) {
      invoiceToIssue = await tx.invoice.update({
        where: { id: invoice.id },
        data: sellerSnapshot(),
        include: { lines: { orderBy: { sortOrder: "asc" } } },
      });
    }

    const missingSellerFields = [
      ["INVOICE_SELLER_NAME", invoiceToIssue.sellerName],
      ["INVOICE_SELLER_SIREN", invoiceToIssue.sellerSiren],
      ["INVOICE_SELLER_SIRET", invoiceToIssue.sellerSiret],
      ["INVOICE_SELLER_VAT_NUMBER", invoiceToIssue.sellerVatNumber],
      ["INVOICE_SELLER_ADDRESS1", invoiceToIssue.sellerAddress1],
      ["INVOICE_SELLER_POSTAL_CODE", invoiceToIssue.sellerPostalCode],
      ["INVOICE_SELLER_CITY", invoiceToIssue.sellerCity],
      ["INVOICE_SELLER_COUNTRY", invoiceToIssue.sellerCountry],
    ].filter(([, value]) => !value).map(([name]) => name);

    if (missingSellerFields.length) {
      throw new Error(`Identité juridique ADEI incomplète. Variables manquantes : ${missingSellerFields.join(", ")}.`);
    }

    const issuedAt = new Date();
    const year = invoiceYearInFrance(issuedAt);

    const sequence = await tx.invoiceSequence.upsert({
      where: { year },
      create: { year, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });

    const number = formatInvoiceNumber(year, sequence.lastNumber);

    const issued = await tx.invoice.update({
      where: { id: invoiceToIssue.id },
      data: {
        number,
        status: "ISSUED",
        issuedAt,
      },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });

    return { invoice: issued, issued: true as const };
  });
}
