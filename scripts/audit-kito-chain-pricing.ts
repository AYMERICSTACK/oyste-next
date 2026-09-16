import { prisma } from "../lib/db/prisma";
import { getKitoChainPriceComponentRef } from "../lib/pricing/kito-chain-price-rules";
import { getKitoChainWeightRule } from "../lib/shipping/kito-chain-weight";

async function main() {
  console.log("OYSTE — KITO V2.12.13.8 — audit tarification chaîne dynamique\n");
  console.log("Mode : LECTURE SEULE — aucune modification BDD\n");

  const products = await prisma.product.findMany({
    where: { supplier: { name: { equals: "KITO", mode: "insensitive" } } },
    include: { variants: true },
    orderBy: { code: "asc" },
  });

  const refs = products.flatMap((product) =>
    product.variants.length ? product.variants.map((variant) => variant.code) : [product.code],
  );

  const componentRefs = Array.from(
    new Set(refs.map((code) => getKitoChainPriceComponentRef(code)).filter((value): value is string => Boolean(value))),
  );

  const erpRows = await prisma.erpProductRecord.findMany({
    where: { ref: { in: componentRefs }, isActive: true },
    select: { ref: true, label: true, costPrice: true },
    orderBy: { ref: "asc" },
  });
  const erp = new Map(erpRows.map((row) => [row.ref.toUpperCase(), row]));

  let withRule = 0;
  let withPrice = 0;
  const missing = new Set<string>();

  for (const code of refs) {
    if (!getKitoChainWeightRule(code)) continue;
    withRule += 1;
    const componentRef = getKitoChainPriceComponentRef(code);
    const row = componentRef ? erp.get(componentRef.toUpperCase()) : undefined;
    if (!componentRef || !row || Number(row.costPrice) <= 0) {
      missing.add(`${code} -> ${componentRef || "AUCUN COMPOSANT"}`);
      continue;
    }
    withPrice += 1;
  }

  console.log(`Variantes/références KITO : ${refs.length}`);
  console.log(`Avec règle poids chaîne : ${withRule}`);
  console.log(`Avec composant tarif ERP exploitable : ${withPrice}`);
  console.log(`Sans tarif ERP : ${missing.size}\n`);

  console.log("Composants ERP utilisés :");
  for (const row of erpRows) {
    const pa = Number(row.costPrice);
    const pv = Math.round((pa / 0.75) * 100) / 100;
    console.log(`- ${row.ref} · PA ${pa.toFixed(2)} € / m · PV ${pv.toFixed(2)} € HT / m · ${row.label}`);
  }

  if (missing.size) {
    console.log("\nRéférences sans tarif :");
    for (const line of missing) console.log(`- ${line}`);
  }

  console.log("\nAucune donnée modifiée.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
