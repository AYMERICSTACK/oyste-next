import "dotenv/config";

import { prisma } from "../lib/db/prisma";

function compactJson(value: unknown): string {
  if (value === null || value === undefined) return "";
  try { return JSON.stringify(value); } catch { return String(value); }
}

async function main() {
  const supplier = await prisma.supplier.findFirst({
    where: { name: { equals: "KITO", mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (!supplier) throw new Error("Fournisseur KITO introuvable.");

  const products = await prisma.product.findMany({
    where: { supplierId: supplier.id },
    orderBy: { code: "asc" },
    select: {
      code: true,
      supplierCode: true,
      name: true,
      weightKg: true,
      shippingMode: true,
      sourceData: true,
      variants: {
        orderBy: { code: "asc" },
        select: {
          code: true,
          supplierCode: true,
          name: true,
          label: true,
          weightKg: true,
          shippingMode: true,
          options: true,
          sourceData: true,
        },
      },
    },
  });

  console.log("\nOYSTE — Pré-audit correspondance poids KITO");
  console.log("----------------------------------------");
  console.log("LECTURE SEULE — aucune modification BDD");
  console.log("Objectif : récupérer les identifiants exacts nécessaires au croisement avec les catalogues KITO.\n");

  let variants = 0;
  for (const product of products) {
    console.log(`\n[PARENT] ${product.code} | supplierCode=${product.supplierCode ?? ""} | ${product.name}`);
    console.log(`  transport=${product.shippingMode} | poids=${product.weightKg ?? ""}`);
    for (const variant of product.variants) {
      variants += 1;
      console.log(
        `[VARIANTE] ${variant.code}` +
        ` | supplierCode=${variant.supplierCode ?? ""}` +
        ` | name=${variant.name}` +
        ` | label=${variant.label ?? ""}` +
        ` | poids=${variant.weightKg ?? ""}` +
        ` | transport=${variant.shippingMode ?? "HERITE"}` +
        ` | options=${compactJson(variant.options)}` +
        ` | source=${compactJson(variant.sourceData)}`,
      );
    }
  }

  console.log("\nRésumé");
  console.log(`- Fiches KITO : ${products.length}`);
  console.log(`- Variantes KITO : ${variants}`);
  console.log("- Aucune donnée modifiée.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
