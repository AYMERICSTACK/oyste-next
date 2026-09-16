import "dotenv/config";

import { prisma } from "../lib/db/prisma";

const CONFIRM_TOKEN = "APPLY-KITO-SHIPPING";

type WeightSource = "KITO_CATALOG_DIRECT" | "KITO_CATALOG_DERIVED_LIFT";
type WeightRule = { weightKg: number; source: WeightSource; note?: string };

const W = (weightKg: number, source: WeightSource = "KITO_CATALOG_DIRECT", note?: string): WeightRule => ({
  weightKg,
  source,
  note,
});

// KITO V2.12.13.5
// IMPORTANT: these weights are intentionally limited to references/configurations
// that can be matched unambiguously against the supplied KITO catalogues.
const WEIGHTS: Record<string, WeightRule> = {
  // CB — standard catalogue lift
  CB005: W(10),
  CB010: W(11.5),
  CB015: W(14.5),
  CB020: W(20),
  CB025: W(27),
  CB030: W(24),
  CB050: W(41),

  // CX — CX010 intentionally unresolved (not present in supplied catalogue)
  CX003: W(2.4),
  CX005: W(4.5),

  // ED — direct control, non-parenthesized catalogue net mass
  ED06S: W(11.5),
  ED10S: W(11.5),
  ED18S: W(11.5),
  ED16S: W(15.5),
  ED24S: W(15.5),
  ED06ST: W(12),
  ED10ST: W(12),
  ED18ST: W(12),
  ED16ST: W(16),
  ED24ST: W(16),
  ED48S: W(21),
  ED48ST: W(21),

  // EDC cylinder control
  EDC06SD: W(14.5),
  EDC10SD: W(14.5),
  EDC18SD: W(14.5),
  EDC16SD: W(18.5),
  EDC24SD: W(18.5),

  // EQ — three-phase catalogue configurations only
  EQ001IS: W(30),
  EQ003IS: W(30),
  EQ005IS: W(32),
  EQ010IS: W(42),
  EQM001ISIS: W(63),
  EQM003ISIS: W(64),
  EQM005ISIS: W(66),
  EQM010ISIS: W(75),
  EQSP001IS: W(34),
  EQSP003IS: W(34),
  EQSP005IS: W(36),
  EQSP010IS: W(49),

  // ER2 hook suspension — 016/032 intentionally unresolved (catalogue uses 015/030)
  ER2001H: W(27),
  ER2001IH: W(27),
  ER2003S: W(27),
  ER2003IS: W(27),
  ER2005L: W(33),
  ER2005IL: W(32),
  ER2010L: W(47),
  ER2010IL: W(45),
  ER2020L: W(73),
  ER2020IL: W(73),
  ER2025S: W(104),
  ER2025IS: W(100),
  ER2050S: W(132),
  ER2050IS: W(128),

  // ER2M motorized trolley — catalogue net mass does not vary by S/IS trolley-speed suffix
  ER2M001HS: W(58),
  ER2M001IHIS: W(59),
  ER2M001IHS: W(59),
  ER2M003SS: W(58),
  ER2M003ISIS: W(59),
  ER2M003ISS: W(59),
  ER2M005LS: W(64),
  ER2M005ILIS: W(65),
  ER2M005ILS: W(65),
  ER2M010LS: W(77),
  ER2M010ILIS: W(77),
  ER2M010ILS: W(77),
  ER2M020LS: W(111),
  ER2M020ILIS: W(112),
  ER2M020ILS: W(112),
  ER2M025SS: W(152),
  ER2M025ISIS: W(151),
  ER2M025ISS: W(151),
  ER2M050SS: W(202),
  ER2M050ISIS: W(200),
  ER2M050ISS: W(200),

  // ER2SG geared trolley
  ER2SG001H: W(40),
  ER2SG001IH: W(40),
  ER2SG003S: W(40),
  ER2SG003IS: W(40),
  ER2SG005L: W(46),
  ER2SG005IL: W(45),
  ER2SG010L: W(59),
  ER2SG010IL: W(57),
  ER2SG020L: W(90),
  ER2SG020IL: W(90),
  ER2SG025S: W(132),
  ER2SG025IS: W(128),
  ER2SG050S: W(188),
  ER2SG050IS: W(184),

  // ER2SP plain trolley
  ER2SP001H: W(32),
  ER2SP001IH: W(32),
  ER2SP003S: W(32),
  ER2SP003IS: W(32),
  ER2SP005L: W(38),
  ER2SP005IL: W(37),
  ER2SP010L: W(55),
  ER2SP010IL: W(53),
  ER2SP020L: W(86),
  ER2SP020IL: W(86),
  ER2SP025S: W(128),
  ER2SP025IS: W(124),
  ER2SP050S: W(182),
  ER2SP050IS: W(178),

  // LB — catalogue standard lift is 1.5m; 3m variants use the catalogue's
  // explicit additional kg per metre: base + (3.0 - 1.5) * kg/m.
  LB008HL15: W(5.7),
  LB008HL30: W(6.75, "KITO_CATALOG_DERIVED_LIFT", "5.7 + 1.5 × 0.7"),
  LB010HL15: W(5.9),
  LB010HL30: W(6.95, "KITO_CATALOG_DERIVED_LIFT", "5.9 + 1.5 × 0.7"),
  LB016HL15: W(8),
  LB016HL30: W(9.65, "KITO_CATALOG_DERIVED_LIFT", "8 + 1.5 × 1.1"),
  LB025HL15: W(11.2),
  LB025HL30: W(13.75, "KITO_CATALOG_DERIVED_LIFT", "11.2 + 1.5 × 1.7"),
  LB032HL15: W(15),
  LB032HL30: W(18.45, "KITO_CATALOG_DERIVED_LIFT", "15 + 1.5 × 2.3"),
  LB063HL15: W(26),
  LB063HL30: W(33.05, "KITO_CATALOG_DERIVED_LIFT", "26 + 1.5 × 4.7"),
  LB090HL15: W(40),
  LB090HL30: W(50.5, "KITO_CATALOG_DERIVED_LIFT", "40 + 1.5 × 7"),
};

const EXPECTED_KITO_PARENTS = 17;
const EXPECTED_KITO_VARIANTS = 174;
const EXPECTED_WEIGHT_MATCHES = 115;

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
    select: { id: true, name: true },
  });
  if (!supplier) throw new Error("Fournisseur KITO introuvable.");

  const products = await prisma.product.findMany({
    where: { supplierId: supplier.id },
    select: {
      id: true,
      code: true,
      name: true,
      shippingMode: true,
      weightKg: true,
      variants: {
        orderBy: { code: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          shippingMode: true,
          weightKg: true,
        },
      },
    },
    orderBy: { code: "asc" },
  });

  const variants = products.flatMap((product) => product.variants.map((variant) => ({ product, variant })));
  const dbCodes = new Set(variants.map(({ variant }) => variant.code));
  const weightCodes = Object.keys(WEIGHTS);
  const missingMappedCodes = weightCodes.filter((code) => !dbCodes.has(code));

  if (products.length !== EXPECTED_KITO_PARENTS) {
    throw new Error(`Sécurité: ${products.length} fiche(s) KITO trouvée(s), ${EXPECTED_KITO_PARENTS} attendues.`);
  }
  if (variants.length !== EXPECTED_KITO_VARIANTS) {
    throw new Error(`Sécurité: ${variants.length} variante(s) KITO trouvée(s), ${EXPECTED_KITO_VARIANTS} attendues.`);
  }
  if (weightCodes.length !== EXPECTED_WEIGHT_MATCHES) {
    throw new Error(`Sécurité: la table contient ${weightCodes.length} poids, ${EXPECTED_WEIGHT_MATCHES} attendus.`);
  }
  if (missingMappedCodes.length) {
    throw new Error(`Sécurité: référence(s) de la table absente(s) de KITO: ${missingMappedCodes.join(", ")}`);
  }

  let parentModeChanges = 0;
  let variantModeChanges = 0;
  let weightChanges = 0;
  let directWeights = 0;
  let derivedWeights = 0;
  const unresolved: string[] = [];

  console.log("\nOYSTE — KITO V2.12.13.5");
  console.log("-------------------------");
  console.log(apply ? "Mode : APPLICATION BDD" : "Mode : DRY-RUN — aucune modification BDD");
  console.log("Règle transport : tous les produits/variantes KITO → MESSAGERIE");
  console.log("Règle poids : uniquement les correspondances KITO certaines\n");

  for (const product of products) {
    if (product.shippingMode !== "MESSAGERIE") {
      parentModeChanges += 1;
      console.log(`[PARENT] ${product.code}: transport ${product.shippingMode} → MESSAGERIE`);
    }

    for (const variant of product.variants) {
      if (variant.shippingMode !== "MESSAGERIE") {
        variantModeChanges += 1;
      }

      const rule = WEIGHTS[variant.code];
      if (!rule) {
        unresolved.push(variant.code);
        continue;
      }

      if (rule.source === "KITO_CATALOG_DIRECT") directWeights += 1;
      else derivedWeights += 1;

      if (!sameNumber(variant.weightKg, rule.weightKg)) {
        weightChanges += 1;
        console.log(
          `[POIDS] ${variant.code}: ${numberOrNull(variant.weightKg) ?? "vide"} → ${rule.weightKg} kg` +
            `${rule.note ? ` (${rule.note})` : ""}`,
        );
      }
    }
  }

  console.log("\nRésumé prévisionnel");
  console.log(`- Fiches KITO : ${products.length}`);
  console.log(`- Variantes KITO : ${variants.length}`);
  console.log(`- Parents à passer en MESSAGERIE : ${parentModeChanges}`);
  console.log(`- Variantes à passer en MESSAGERIE : ${variantModeChanges}`);
  console.log(`- Références avec poids KITO certain : ${weightCodes.length}/${variants.length}`);
  console.log(`  - poids directs catalogue : ${directWeights}`);
  console.log(`  - poids calculés depuis levée + kg/m catalogue : ${derivedWeights}`);
  console.log(`- Poids effectivement à modifier : ${weightChanges}`);
  console.log(`- Références volontairement sans nouveau poids : ${unresolved.length}`);
  console.log(`  ${unresolved.join(", ")}`);

  if (!apply) {
    console.log(`\nDRY-RUN terminé. Pour appliquer :`);
    console.log(`npx tsx scripts/apply-kito-shipping.ts --confirm=${CONFIRM_TOKEN}\n`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const product of products) {
      if (product.shippingMode !== "MESSAGERIE") {
        await tx.product.update({
          where: { id: product.id },
          data: { shippingMode: "MESSAGERIE" },
        });
      }

      for (const variant of product.variants) {
        const rule = WEIGHTS[variant.code];
        const data: { shippingMode?: "MESSAGERIE"; weightKg?: number } = {};

        if (variant.shippingMode !== "MESSAGERIE") data.shippingMode = "MESSAGERIE";
        if (rule && !sameNumber(variant.weightKg, rule.weightKg)) data.weightKg = rule.weightKg;

        if (Object.keys(data).length) {
          await tx.productVariant.update({ where: { id: variant.id }, data });
        }
      }
    }
  });

  console.log("\nApplication terminée.");
  console.log(`- ${parentModeChanges} parent(s) passé(s) en MESSAGERIE`);
  console.log(`- ${variantModeChanges} variante(s) passée(s) en MESSAGERIE`);
  console.log(`- ${weightChanges} poids variante(s) mis à jour`);
  console.log(`- ${unresolved.length} référence(s) sans poids laissée(s) intacte(s)`);
  console.log("- Prix, délais, dimensions, stocks, slugs, médias, catégories et statuts : non modifiés.\n");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
