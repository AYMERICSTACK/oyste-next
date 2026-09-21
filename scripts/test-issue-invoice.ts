import "dotenv/config";

import { prisma } from "@/lib/db/prisma";
import { issueInvoiceDraft } from "@/lib/invoices/invoice-service";

function printResult(label: string, result: Awaited<ReturnType<typeof issueInvoiceDraft>>) {
  const { invoice, issued } = result;
  console.log(`\n${label}`);
  console.log("-".repeat(label.length));
  console.log(`issued       : ${issued}`);
  console.log(`invoice.id   : ${invoice.id}`);
  console.log(`status       : ${invoice.status}`);
  console.log(`number       : ${invoice.number ?? "-"}`);
  console.log(`issuedAt     : ${invoice.issuedAt?.toISOString() ?? "-"}`);
  console.log(`sourceKey    : ${invoice.sourceKey ?? "-"}`);
}

async function main() {
  const invoiceId = process.argv[2]?.trim();
  if (!invoiceId) {
    throw new Error("Usage: npx tsx scripts/test-issue-invoice.ts <invoiceId>");
  }

  console.log("OYSTE - Test emission Facturation V2");
  console.log("===================================");
  console.log(`Invoice : ${invoiceId}`);

  const before = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!before) throw new Error("Facture introuvable.");

  console.log(`Avant : ${before.status} | ${before.number ?? "sans numero"}`);
  if (before.status !== "DRAFT" && before.status !== "ISSUED") {
    throw new Error(`Statut non testable : ${before.status}`);
  }

  console.log("\n1) Premier appel...");
  const first = await issueInvoiceDraft(invoiceId);
  printResult("Resultat du premier appel", first);

  console.log("\n2) Deuxieme appel sur la meme facture (test idempotence)...");
  const second = await issueInvoiceDraft(invoiceId);
  printResult("Resultat du deuxieme appel", second);

  const sameId = first.invoice.id === second.invoice.id;
  const sameNumber = Boolean(first.invoice.number) && first.invoice.number === second.invoice.number;
  const issuedCount = await prisma.invoice.count({ where: { number: first.invoice.number } });

  console.log("\nCONTROLE FINAL");
  console.log("==============");
  console.log(`Meme invoice.id      : ${sameId}`);
  console.log(`Meme numero          : ${sameNumber}`);
  console.log(`Nb facture ce numero : ${issuedCount}`);
  console.log(`Premier appel issued : ${first.issued}`);
  console.log(`Deuxieme appel issued: ${second.issued}`);

  if (!sameId || !sameNumber || issuedCount !== 1 || second.issued !== false) {
    throw new Error("ECHEC - controle d'idempotence de l'emission invalide.");
  }

  console.log(`\nOK - emission idempotente validee : ${first.invoice.number}`);
}

main()
  .catch((error) => {
    console.error("\nERREUR:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
