import "dotenv/config";

import { prisma } from "../lib/db/prisma";

const TARGET_SUPPLIERS = ["CROMOX", "HYDROBULL"] as const;
const CONFIRMATION = "DELETE-CROMOX-HYDROBULL";
const shouldDelete = process.argv.includes(`--confirm=${CONFIRMATION}`);

async function main() {
  const suppliers = await prisma.supplier.findMany({
    where: {
      OR: TARGET_SUPPLIERS.map((name) => ({
        name: { equals: name, mode: "insensitive" as const },
      })),
    },
    select: {
      id: true,
      name: true,
      _count: { select: { products: true } },
    },
    orderBy: { name: "asc" },
  });

  const foundNames = new Set(suppliers.map((supplier) => supplier.name.toUpperCase()));
  const missing = TARGET_SUPPLIERS.filter((name) => !foundNames.has(name));
  const productCount = suppliers.reduce((sum, supplier) => sum + supplier._count.products, 0);

  console.log("\nOYSTE — suppression fournisseurs ciblée");
  console.log("--------------------------------------");
  for (const supplier of suppliers) {
    console.log(`- ${supplier.name}: ${supplier._count.products} produit(s)`);
  }
  if (missing.length) console.log(`- Introuvable(s): ${missing.join(", ")}`);
  console.log(`Total à supprimer: ${productCount} produit(s), ${suppliers.length} fournisseur(s).\n`);

  if (!shouldDelete) {
    console.log("DRY-RUN uniquement : aucune donnée supprimée.");
    console.log(`Pour confirmer: npm run suppliers:remove:cromox-hydrobull -- --confirm=${CONFIRMATION}`);
    return;
  }

  if (suppliers.length === 0) {
    console.log("Aucun fournisseur cible présent. Rien à supprimer.");
    return;
  }

  const supplierIds = suppliers.map((supplier) => supplier.id);

  const result = await prisma.$transaction(async (tx) => {
    // Les relations enfants du produit sont en cascade. Les lignes de commandes
    // conservent leur historique et perdent seulement le lien produit/variante (SetNull).
    const deletedProducts = await tx.product.deleteMany({
      where: { supplierId: { in: supplierIds } },
    });

    const deletedSuppliers = await tx.supplier.deleteMany({
      where: { id: { in: supplierIds } },
    });

    return { deletedProducts, deletedSuppliers };
  });

  console.log(
    `Suppression terminée : ${result.deletedProducts.count} produit(s) et ${result.deletedSuppliers.count} fournisseur(s) supprimé(s).`,
  );
}

main()
  .catch((error) => {
    console.error("Suppression interrompue :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
