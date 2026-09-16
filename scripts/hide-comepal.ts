import "dotenv/config";
import { prisma } from "../lib/db/prisma";

const CONFIRMATION = "HIDE-COMEPAL";
const apply = process.argv.includes(`--confirm=${CONFIRMATION}`);

async function main() {
  const suppliers = await prisma.supplier.findMany({
    where: { OR: [
      { name: { equals: "COMEPAL", mode: "insensitive" } },
      { slug: { equals: "comepal", mode: "insensitive" } },
      { code: { equals: "COMEPAL", mode: "insensitive" } },
    ] },
    select: { id: true, name: true, slug: true, isActive: true },
  });
  if (suppliers.length !== 1) {
    throw new Error(`Attendu : un fournisseur COMEPAL. Trouvés : ${suppliers.length}. Aucune modification.`);
  }
  const supplier = suppliers[0];
  const where = { supplierId: supplier.id };
  const counts = await prisma.product.groupBy({
    by: ["publicationStatus"], where, _count: { _all: true },
  });
  console.log("OYSTE — COMEPAL — dépublication temporaire");
  console.log("Mode :", apply ? "APPLICATION BDD" : "DRY-RUN");
  console.log("Fournisseur :", supplier.name, supplier.id);
  console.log("Statuts actuels :", counts);
  console.log("Action : produits PUBLISHED → HIDDEN ; fournisseur isActive → false.");
  console.log("Les autres statuts, variantes, prix, images et historiques sont conservés.");
  if (!apply) {
    console.log(`Aucune modification. Pour appliquer : --confirm=${CONFIRMATION}`);
    return;
  }
  const result = await prisma.$transaction(async (tx) => {
    const products = await tx.product.updateMany({
      where: { ...where, publicationStatus: "PUBLISHED" },
      data: { publicationStatus: "HIDDEN" },
    });
    await tx.supplier.update({
      where: { id: supplier.id }, data: { isActive: false },
    });
    return products.count;
  });
  console.log(`Terminé : ${result} produit(s) dépublié(s), fournisseur désactivé.`);
  console.log("Aucune suppression. Réactivation à préparer séparément après audit.");
}
main().catch(error => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
