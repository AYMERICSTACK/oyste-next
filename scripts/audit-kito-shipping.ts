import "dotenv/config";

import { prisma } from "../lib/db/prisma";

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function main() {
  const supplier = await prisma.supplier.findFirst({
    where: { name: { equals: "KITO", mode: "insensitive" } },
    select: { id: true, name: true },
  });

  if (!supplier) throw new Error("Fournisseur KITO introuvable.");

  const products = await prisma.product.findMany({
    where: { supplierId: supplier.id },
    select: {
      code: true,
      name: true,
      publicationStatus: true,
      shippingMode: true,
      weightKg: true,
      variants: {
        orderBy: { code: "asc" },
        select: {
          code: true,
          name: true,
          shippingMode: true,
          weightKg: true,
        },
      },
    },
    orderBy: { code: "asc" },
  });

  let variantCount = 0;
  let variantEffectiveMessagerie = 0;
  let variantWrongMode = 0;
  let variantMissingWeight = 0;
  let parentMessagerie = 0;
  let parentWrongMode = 0;
  let parentMissingWeight = 0;

  console.log("\nOYSTE — Audit transport KITO");
  console.log("---------------------------");
  console.log("Mode : LECTURE SEULE — aucune modification BDD");
  console.log("Règle attendue : KITO → MESSAGERIE\n");

  for (const product of products) {
    const parentWeight = numberOrNull(product.weightKg);
    const parentModeOk = product.shippingMode === "MESSAGERIE";

    if (parentModeOk) parentMessagerie += 1;
    else parentWrongMode += 1;
    if (!parentWeight || parentWeight <= 0) parentMissingWeight += 1;

    console.log(`\n${parentModeOk ? "✓" : "⚠"} ${product.code} · ${product.name}`);
    console.log(`  Parent : mode=${product.shippingMode} · poids=${parentWeight && parentWeight > 0 ? `${parentWeight} kg` : "MANQUANT"} · statut=${product.publicationStatus}`);

    for (const variant of product.variants) {
      variantCount += 1;
      const effectiveMode = variant.shippingMode ?? product.shippingMode;
      const effectiveWeight = numberOrNull(variant.weightKg) ?? parentWeight;
      const modeOk = effectiveMode === "MESSAGERIE";
      const weightOk = effectiveWeight !== null && effectiveWeight > 0;

      if (modeOk) variantEffectiveMessagerie += 1;
      else variantWrongMode += 1;
      if (!weightOk) variantMissingWeight += 1;

      if (!modeOk || !weightOk) {
        console.log(
          `  ${modeOk && weightOk ? "✓" : "⚠"} ${variant.code}` +
            ` · mode stocké=${variant.shippingMode ?? "hérité"}` +
            ` · mode effectif=${effectiveMode}` +
            ` · poids=${weightOk ? `${effectiveWeight} kg` : "MANQUANT"}`,
        );
      }
    }
  }

  console.log("\nRésumé");
  console.log(`- Fiches KITO : ${products.length}`);
  console.log(`- Variantes KITO : ${variantCount}`);
  console.log(`- Parents en MESSAGERIE : ${parentMessagerie}/${products.length}`);
  console.log(`- Parents avec autre mode : ${parentWrongMode}`);
  console.log(`- Parents sans poids : ${parentMissingWeight}`);
  console.log(`- Variantes en MESSAGERIE effective : ${variantEffectiveMessagerie}/${variantCount}`);
  console.log(`- Variantes avec autre mode effectif : ${variantWrongMode}`);
  console.log(`- Variantes sans poids effectif : ${variantMissingWeight}`);
  console.log("\nAudit terminé : aucune donnée modifiée.\n");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
