import "dotenv/config";

import { prisma } from "../lib/db/prisma";
import { MESSAGERIE_WEIGHTS_KG } from "../lib/shipping/shipping-data";

const CONFIGURATOR_FAMILIES = /^(PFI|PFT|PMI|PMT|PMA|PMAM|PORT)/i;

async function main() {
  const products = await prisma.product.findMany({
    include: { supplier: true, variants: true },
  });
  let updatedProducts = 0;
  let updatedVariants = 0;

  for (const product of products) {
    const supplierName = product.supplier?.name?.trim().toUpperCase() || "";
    const productCode = product.code.trim().toUpperCase().replace(/\s+/g, "");
    const configured =
      product.experienceType === "CONFIGURABLE" ||
      CONFIGURATOR_FAMILIES.test(product.configuratorFamily || "") ||
      CONFIGURATOR_FAMILIES.test(productCode);
    const officialWeight = MESSAGERIE_WEIGHTS_KG[productCode];
    const shippingMode = supplierName.includes("STOCKMANN")
      ? "INCLUDED"
      : officialWeight
        ? "MESSAGERIE"
        : configured
          ? "AFFRETEMENT"
          : "QUOTE";

    await prisma.product.update({
      where: { id: product.id },
      data: {
        shippingMode,
        ...(officialWeight ? { weightKg: officialWeight } : {}),
      },
    });
    updatedProducts += 1;

    for (const variant of product.variants) {
      const code = variant.code.trim().toUpperCase().replace(/\s+/g, "");
      const weightKg = MESSAGERIE_WEIGHTS_KG[code];
      if (!weightKg) continue;
      await prisma.productVariant.update({
        where: { id: variant.id },
        data: { weightKg, shippingMode: "MESSAGERIE" },
      });
      updatedVariants += 1;
    }
  }

  console.log(
    `Shipping backfill terminé : ${updatedProducts} produits, ${updatedVariants} variantes.`,
  );
}

main().finally(() => prisma.$disconnect());
