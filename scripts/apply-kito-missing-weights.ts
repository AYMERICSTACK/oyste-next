import "dotenv/config";

import { prisma } from "../lib/db/prisma";

const CONFIRM_TOKEN = "APPLY-KITO-MISSING-WEIGHTS";

const WEIGHTS: Record<string, number> = {
  // CX — brochure principale KITO FR, hauteur standard 3 m
  CX010: 7.3,

  // EQS — brochure principale KITO FR, poids net palan seul
  EQS005IS: 33,
  EQS010IS: 43,

  // ER2 fixe — brochure principale KITO FR
  ER2016IS: 72,
  ER2016S: 72,
  ER2032IS: 105,
  ER2032S: 105,

  // LX — brochure principale KITO FR, poids directement donné pour 1,5 m / 3 m
  LX003HL15: 1.7,
  LX003HL30: 2.0,
  LX005HL15: 2.7,
  LX005HL30: 3.3,

  // TSG — Standard (A) et W30 (B) ont le même poids dans la brochure
  TSG250A: 13.5,
  TSG250B: 13.5,
  TSG500A: 13.5,
  TSG500B: 13.5,
  TSG1000A: 13.5,
  TSG1000B: 13.5,
  TSG1500A: 20,
  TSG1500B: 20,
  TSG2000A: 21,
  TSG2000B: 21,
  TSG2500A: 30,
  TSG2500B: 30,
  TSG3000A: 30,
  TSG3000B: 30,
  TSG5000A: 60,
  TSG5000B: 60,

  // TSP — Standard (A) et W30 (B) ont le même poids dans la brochure
  TSP250A: 5.1,
  TSP250B: 5.1,
  TSP500A: 5.1,
  TSP500B: 5.1,
  TSP1000A: 8,
  TSP1000B: 8,
  TSP1500A: 14,
  TSP1500B: 14,
  TSP2000A: 14,
  TSP2000B: 14,
  TSP2500A: 23,
  TSP2500B: 23,
  TSP3000A: 23,
  TSP3000B: 23,
  TSP5000A: 50,
  TSP5000B: 50,
};

const EXPECTED_KITO_PARENTS = 17;
const EXPECTED_KITO_VARIANTS = 174;
const EXPECTED_NEW_WEIGHTS = 43;
const EXPECTED_REMAINING_WITHOUT_WEIGHT = 16;

const EXPECTED_REMAINING_CODES = [
  "EQSSP005IS",
  "EQSSP010IS",
  "ER2M016ISIS",
  "ER2M016ISS",
  "ER2M016SS",
  "ER2M032ISIS",
  "ER2M032ISS",
  "ER2M032SS",
  "ER2SG016IS",
  "ER2SG016S",
  "ER2SG032IS",
  "ER2SG032S",
  "ER2SP016IS",
  "ER2SP016S",
  "ER2SP032IS",
  "ER2SP032S",
].sort();

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sameNumber(a: unknown, b: number): boolean {
  const n = numberOrNull(a);
  return n !== null && Math.abs(n - b) < 0.0005;
}

async function main() {
  const apply = process.argv.includes(`--confirm=${CONFIRM_TOKEN}`);

  const supplier = await prisma.supplier.findFirst({
    where: { name: { equals: "KITO", mode: "insensitive" } },
    select: { id: true },
  });
  if (!supplier) throw new Error("Fournisseur KITO introuvable.");

  const products = await prisma.product.findMany({
    where: { supplierId: supplier.id },
    select: {
      id: true,
      code: true,
      shippingMode: true,
      variants: {
        orderBy: { code: "asc" },
        select: { id: true, code: true, shippingMode: true, weightKg: true },
      },
    },
    orderBy: { code: "asc" },
  });

  const variants = products.flatMap((product) => product.variants);
  const byCode = new Map(variants.map((variant) => [variant.code, variant]));
  const targetCodes = Object.keys(WEIGHTS);
  const absentTargets = targetCodes.filter((code) => !byCode.has(code));

  if (products.length !== EXPECTED_KITO_PARENTS) {
    throw new Error(`Sécurité: ${products.length} fiche(s) KITO trouvée(s), ${EXPECTED_KITO_PARENTS} attendues.`);
  }
  if (variants.length !== EXPECTED_KITO_VARIANTS) {
    throw new Error(`Sécurité: ${variants.length} variante(s) KITO trouvée(s), ${EXPECTED_KITO_VARIANTS} attendues.`);
  }
  if (targetCodes.length !== EXPECTED_NEW_WEIGHTS) {
    throw new Error(`Sécurité: ${targetCodes.length} nouveaux poids dans le script, ${EXPECTED_NEW_WEIGHTS} attendus.`);
  }
  if (absentTargets.length) {
    throw new Error(`Sécurité: référence(s) ciblée(s) absente(s) de KITO: ${absentTargets.join(", ")}`);
  }

  const parentsNotMessagerie = products.filter((product) => product.shippingMode !== "MESSAGERIE");
  const variantsNotMessagerie = variants.filter((variant) => variant.shippingMode !== "MESSAGERIE");
  if (parentsNotMessagerie.length || variantsNotMessagerie.length) {
    throw new Error(
      `Sécurité: KITO V2.12.13.5 attendu déjà en MESSAGERIE (parents hors règle=${parentsNotMessagerie.length}, variantes hors règle=${variantsNotMessagerie.length}).`,
    );
  }

  console.log("\nOYSTE — KITO V2.12.13.6");
  console.log("-------------------------");
  console.log(apply ? "Mode : APPLICATION BDD" : "Mode : DRY-RUN — aucune modification BDD");
  console.log("Objectif : compléter uniquement les nouveaux poids certains de la brochure principale KITO FR");
  console.log("Transport : inchangé (MESSAGERIE déjà appliqué en V2.12.13.5)\n");

  let changes = 0;
  let alreadyCorrect = 0;
  let nonEmptyTargets = 0;

  for (const code of targetCodes.sort()) {
    const variant = byCode.get(code)!;
    const targetWeight = WEIGHTS[code];
    const current = numberOrNull(variant.weightKg);

    if (sameNumber(current, targetWeight)) {
      alreadyCorrect += 1;
      continue;
    }

    if (current !== null) {
      nonEmptyTargets += 1;
      console.log(`[ATTENTION] ${code}: poids actuel ${current} kg ≠ brochure ${targetWeight} kg`);
      continue;
    }

    changes += 1;
    console.log(`[POIDS] ${code}: vide → ${targetWeight} kg`);
  }

  if (nonEmptyTargets > 0) {
    throw new Error(
      `Sécurité: ${nonEmptyTargets} référence(s) ciblée(s) ont déjà un poids différent. Aucun écrasement automatique.`,
    );
  }

  const currentlyMissing = variants
    .filter((variant) => numberOrNull(variant.weightKg) === null && !WEIGHTS[variant.code])
    .map((variant) => variant.code)
    .sort();

  if (currentlyMissing.length !== EXPECTED_REMAINING_WITHOUT_WEIGHT) {
    throw new Error(
      `Sécurité: après prise en compte des 43 nouveaux poids, ${currentlyMissing.length} référence(s) resteraient sans poids, ${EXPECTED_REMAINING_WITHOUT_WEIGHT} attendues.`,
    );
  }

  if (currentlyMissing.join("|") !== EXPECTED_REMAINING_CODES.join("|")) {
    throw new Error(
      `Sécurité: la liste des références restantes ne correspond pas à l'audit attendu.\nActuel: ${currentlyMissing.join(", ")}`,
    );
  }

  console.log("\nRésumé prévisionnel");
  console.log(`- Fiches KITO : ${products.length}`);
  console.log(`- Variantes KITO : ${variants.length}`);
  console.log(`- Nouveaux poids certains dans cette version : ${targetCodes.length}`);
  console.log(`- Poids à écrire : ${changes}`);
  console.log(`- Déjà corrects : ${alreadyCorrect}`);
  console.log(`- Références qui resteront sans poids : ${currentlyMissing.length}`);
  console.log(`  ${currentlyMissing.join(", ")}`);
  console.log("- Prix, délais, dimensions, stocks, transport, slugs, médias, catégories et statuts : non modifiés.");

  if (!apply) {
    console.log("\nDRY-RUN terminé. Pour appliquer :");
    console.log(`npx tsx scripts/apply-kito-missing-weights.ts --confirm=${CONFIRM_TOKEN}`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const code of targetCodes) {
      const variant = byCode.get(code)!;
      const targetWeight = WEIGHTS[code];
      if (numberOrNull(variant.weightKg) === null) {
        await tx.productVariant.update({
          where: { id: variant.id },
          data: { weightKg: targetWeight },
        });
      }
    }
  });

  console.log("\nApplication terminée.");
  console.log(`- ${changes} poids variante(s) ajouté(s)`);
  console.log(`- ${currentlyMissing.length} référence(s) restent volontairement sans poids`);
  console.log("- Aucun autre champ modifié.");
}

main()
  .catch((error) => {
    console.error("\nErreur KITO V2.12.13.6:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
