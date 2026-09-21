import "dotenv/config";

import { prisma } from "@/lib/db/prisma";
import { createInvoiceDraftFromPaidOrder } from "@/lib/invoices/invoice-service";

function money(value: unknown) {
  if (value === null || value === undefined) return null;
  return Number(value).toFixed(2);
}

function printInvoice(label: string, result: Awaited<ReturnType<typeof createInvoiceDraftFromPaidOrder>>) {
  const { invoice, created } = result;

  console.log(`\n${label}`);
  console.log("-".repeat(label.length));
  console.log(`created              : ${created}`);
  console.log(`invoice.id           : ${invoice.id}`);
  console.log(`sourceKey            : ${invoice.sourceKey}`);
  console.log(`status               : ${invoice.status}`);
  console.log(`type                 : ${invoice.type}`);
  console.log(`number               : ${invoice.number ?? "(pas encore attribue)"}`);
  console.log(`orderId              : ${invoice.orderId}`);
  console.log(`customerId           : ${invoice.customerId}`);
  console.log(`currency             : ${invoice.currency}`);
  console.log(`subtotalHt           : ${money(invoice.subtotalHt)}`);
  console.log(`taxAmount            : ${money(invoice.taxAmount)}`);
  console.log(`totalTtc             : ${money(invoice.totalTtc)}`);
  console.log(`paymentMethod        : ${invoice.paymentMethod ?? "-"}`);
  console.log(`paymentStatus        : ${invoice.paymentStatus ?? "-"}`);
  console.log(`paidAt               : ${invoice.paidAt?.toISOString() ?? "-"}`);
  console.log(`sellerBrand          : ${invoice.sellerBrand ?? "-"}`);
  console.log(`sellerName           : ${invoice.sellerName ?? "-"}`);
  console.log(`sellerSiren          : ${invoice.sellerSiren ?? "-"}`);
  console.log(`sellerSiret          : ${invoice.sellerSiret ?? "-"}`);
  console.log(`sellerVatNumber      : ${invoice.sellerVatNumber ?? "-"}`);
  console.log(`buyerCompany         : ${invoice.buyerCompany ?? "-"}`);
  console.log(`buyerSiren           : ${invoice.buyerSiren ?? "-"}`);
  console.log(`buyerSiret           : ${invoice.buyerSiret ?? "-"}`);
  console.log(`buyerVatNumber       : ${invoice.buyerVatNumber ?? "-"}`);
  console.log(`buyerAddress         : ${[
    invoice.buyerAddress1,
    invoice.buyerAddress2,
    invoice.buyerPostalCode,
    invoice.buyerCity,
    invoice.buyerCountry,
  ].filter(Boolean).join(", ") || "-"}`);

  console.log("\nLignes :");
  for (const line of invoice.lines) {
    console.log(
      `  ${line.sortOrder + 1}. ${line.reference ?? "-"} | ${line.name} | qte ${line.quantity} | ` +
        `PU HT ${money(line.unitPriceHt)} | HT ${money(line.totalHt)} | TVA ${money(line.taxAmount)} | TTC ${money(line.totalTtc)}`,
    );
  }
}

async function main() {
  const reference = process.argv[2]?.trim();

  if (!reference) {
    throw new Error(
      'Reference commande manquante. Exemple : npx tsx scripts/test-create-invoice.ts OYSTE-2026-09166037',
    );
  }

  console.log("OYSTE - Test Facturation V2");
  console.log("===========================");
  console.log(`Commande : ${reference}`);

  const order = await prisma.order.findUnique({
    where: { reference },
    select: {
      id: true,
      reference: true,
      paymentStatus: true,
      paymentMethod: true,
      paidAt: true,
      subtotalHt: true,
      taxAmount: true,
      totalTtc: true,
    },
  });

  if (!order) throw new Error(`Commande ${reference} introuvable.`);

  console.log(`paymentStatus : ${order.paymentStatus}`);
  console.log(`paymentMethod : ${order.paymentMethod}`);
  console.log(`paidAt        : ${order.paidAt?.toISOString() ?? "-"}`);
  console.log(`commande HT   : ${money(order.subtotalHt)}`);
  console.log(`commande TVA  : ${money(order.taxAmount)}`);
  console.log(`commande TTC  : ${money(order.totalTtc)}`);

  if (order.paymentStatus !== "PAID" || !order.paidAt) {
    throw new Error("Cette commande n'est pas payee. Aucun brouillon de facture ne sera cree.");
  }

  console.log("\n1) Premier appel... ");
  const first = await createInvoiceDraftFromPaidOrder(order.id);
  printInvoice("Resultat du premier appel", first);

  console.log("\n2) Deuxieme appel sur la meme commande (test idempotence)...");
  const second = await createInvoiceDraftFromPaidOrder(order.id);
  printInvoice("Resultat du deuxieme appel", second);

  const sameInvoice = first.invoice.id === second.invoice.id;
  const invoiceCount = await prisma.invoice.count({
    where: { sourceKey: `ORDER:${order.id}:INVOICE` },
  });

  console.log("\nCONTROLE FINAL");
  console.log("==============");
  console.log(`Meme invoice.id        : ${sameInvoice}`);
  console.log(`Nb facture sourceKey   : ${invoiceCount}`);
  console.log(`Premier appel created  : ${first.created}`);
  console.log(`Deuxieme appel created : ${second.created}`);

  if (!sameInvoice || invoiceCount !== 1 || second.created) {
    throw new Error("ECHEC du controle d'idempotence.");
  }

  console.log("\nOK - idempotence validee : une seule facture brouillon existe pour cette commande.");
}

main()
  .catch((error) => {
    console.error("\nERREUR :", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
