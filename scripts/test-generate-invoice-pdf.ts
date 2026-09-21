import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { generateInvoicePdf } from "../lib/invoices/invoice-pdf";

async function main() {
  const invoiceId = process.argv[2]?.trim();
  if (!invoiceId) {
    throw new Error("Usage : npx tsx scripts/test-generate-invoice-pdf.ts <invoiceId>");
  }

  console.log("OYSTE - Test PDF Facturation V2");
  console.log("===============================");
  console.log(`Invoice : ${invoiceId}`);
  console.log("Mode : génération locale uniquement, aucune écriture en base, aucun email.\n");

  const result = await generateInvoicePdf(invoiceId);
  const outputDir = path.join(process.cwd(), "tmp", "invoices");
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, result.filename);
  await writeFile(outputPath, result.bytes);

  console.log(`Numéro : ${result.invoiceNumber}`);
  console.log(`PDF     : ${outputPath}`);
  console.log(`Taille  : ${result.bytes.length} octets`);
  console.log("\nOK - PDF généré localement. Aucune donnée OYSTE n'a été modifiée.");
}

main().catch((error) => {
  console.error("\nERREUR :", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
