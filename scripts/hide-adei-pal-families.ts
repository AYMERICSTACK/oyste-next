import "dotenv/config";
import { prisma } from "../lib/db/prisma";

const prefixes = ["PALBAF", "PALBAR", "PALBAG"];
const confirm = process.argv.includes("--confirm=HIDE-ADEI-PAL-FAMILIES");

async function main() {
  const supplier = await prisma.supplier.findFirst({
    where: { name: { equals: "ADEI", mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (!supplier) throw new Error("Fournisseur ADEI introuvable.");
  const products = await prisma.product.findMany({
    where: { supplierId: supplier.id },
    select: { id: true, code: true, name: true, publicationStatus: true,
      variants: { select: { code: true, supplierCode: true } } },
    orderBy: { code: "asc" },
  });
  const matches = products.filter(p => prefixes.some(prefix =>
    p.code.toUpperCase().startsWith(prefix) ||
    p.variants.some(v => [v.code, v.supplierCode].some(code => code?.toUpperCase().startsWith(prefix)))
  ));
  const ids = matches.map(p => p.id);
  console.log("OYSTE — ADEI — masquage PALBAF / PALBAR / PALBAG");
  console.log("Mode :", confirm ? "APPLICATION" : "DRY-RUN");
  console.log("Fiches concernées :", matches.length);
  for (const p of matches) {
    const counts = Object.fromEntries(prefixes.map(prefix => [prefix,
      p.variants.filter(v => [v.code, v.supplierCode].some(code => code?.toUpperCase().startsWith(prefix))).length]));
    console.log(`${p.code} | ${p.publicationStatus} | ${p.name} | ${JSON.stringify(counts)}`);
  }
  const published = matches.filter(p => p.publicationStatus === "PUBLISHED");
  console.log(`À masquer : ${published.length} fiche(s) publiée(s).`);
  console.log("Les autres statuts, les variantes et toutes les données sont conservés.");
  if (!confirm) { console.log("Aucune modification. Confirmation : --confirm=HIDE-ADEI-PAL-FAMILIES"); return; }
  const result = await prisma.$transaction(async tx => {
    return tx.product.updateMany({
      where: { id: { in: ids }, supplierId: supplier.id, publicationStatus: "PUBLISHED" },
      data: { publicationStatus: "HIDDEN" },
    });
  });
  console.log(`Terminé : ${result.count} fiche(s) masquée(s). Aucune suppression.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
