import "dotenv/config";

import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/db/prisma";
import { calculateAdeiSellingPriceHT, getAdeiCommercialRule } from "../lib/pricing/adei-commercial-rules";
import { resolveAdeiTripodShipping } from "../lib/shipping/adei-tripod-shipping";

const CONFIRMATION = "APPLY-ADEI-COMMERCIAL-RULES";
const shouldApply = process.argv.includes(`--confirm=${CONFIRMATION}`);

type ErpShipping = {
  weightKg?: number;
  packageLengthCm?: number;
  packageWidthCm?: number;
  packageHeightCm?: number;
};

function positive(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function normalizeErpRefCandidate(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[\\/]+/g, "_");
}

function erpReferenceCandidates(code: string, supplierCode?: string | null) {
  const raw = [code, supplierCode].filter((value): value is string => Boolean(value?.trim()));
  const candidates: string[] = [];

  for (const value of raw) {
    const upper = value.trim().toUpperCase();
    const normalized = normalizeErpRefCandidate(value);
    const compact = upper.replace(/[^A-Z0-9]/g, "");

    for (const candidate of [upper, normalized, compact]) {
      if (candidate && !candidates.includes(candidate)) candidates.push(candidate);
    }
  }

  return candidates;
}

function resolveErpRecord<T>(
  map: Map<string, T>,
  code: string,
  supplierCode?: string | null,
) {
  for (const candidate of erpReferenceCandidates(code, supplierCode)) {
    const record = map.get(candidate);
    if (record) return { record, matchedRef: candidate };
  }
  return null;
}

function shippingFromAttributes(value: Prisma.JsonValue | null): ErpShipping {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  return {
    weightKg: positive(source.weightKg),
    packageLengthCm: positive(source.packageLengthCm),
    packageWidthCm: positive(source.packageWidthCm),
    packageHeightCm: positive(source.packageHeightCm),
  };
}

function mergeSourceData(
  current: Prisma.JsonValue | null,
  payload: Record<string, unknown>,
): Prisma.InputJsonValue {
  const root = current && typeof current === "object" && !Array.isArray(current)
    ? { ...(current as Record<string, unknown>) }
    : {};
  return JSON.parse(JSON.stringify({ ...root, ...payload })) as Prisma.InputJsonValue;
}

async function main() {
  const supplier = await prisma.supplier.findFirst({
    where: { name: { equals: "ADEI", mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (!supplier) throw new Error("Fournisseur ADEI introuvable.");

  const [products, erpRows] = await Promise.all([
    prisma.product.findMany({
      where: { supplierId: supplier.id },
      include: {
        category: { select: { name: true, path: true } },
        variants: { orderBy: { code: "asc" } },
      },
      orderBy: { code: "asc" },
    }),
    prisma.erpProductRecord.findMany({
      where: { isActive: true },
      select: { ref: true, costPrice: true, attributes: true },
    }),
  ]);

  const erpByRef = new Map(erpRows.map((row) => [row.ref.trim().toUpperCase(), row]));
  let targeted = 0;
  let priceReady = 0;
  let missingErp = 0;
  let tripodMessagerieReady = 0;
  let tripodAffretementC0Ready = 0;
  let aliasMatches = 0;
  let updatedVariants = 0;
  let updatedProducts = 0;
  const skippedCategories = new Set<string>();

  console.log("\nOYSTE — ADEI règles commerciales");
  console.log("--------------------------------");
  console.log(`Mode : ${shouldApply ? "APPLICATION" : "DRY-RUN"}`);
  console.log("Règles : Portique 23 % · Palonnier 23 % · Crochet 23 % (IS2 25 %) · Chariot porte-palan 25 % · Ligne alim/rail 30 % · Tripode 30 %");
  console.log("Formule : PV HT = PA HT / (1 - marge)");
  console.log("Transport tripode : dimension maxi < 300 cm → MESSAGERIE · dimension maxi ≥ 300 cm → AFFRETEMENT C0. Poids + dimensions ERP obligatoires.\n");

  for (const product of products) {
    const categoryPath = product.category?.path || product.category?.name || "";
    const productRule = getAdeiCommercialRule({ code: product.code, name: product.name, categoryPath });
    if (!productRule) {
      skippedCategories.add(`${product.code} — ${product.name}`);
      continue;
    }
    targeted += 1;

    const nextVariantPrices: number[] = [];
    let successfulVariantPrices = 0;

    if (product.variants.length) {
      for (const variant of product.variants) {
        const rule = getAdeiCommercialRule({ code: variant.code, name: `${product.name} ${variant.name}`, categoryPath }) || productRule;
        const resolvedErp = resolveErpRecord(erpByRef, variant.code, variant.supplierCode);
        if (!resolvedErp) {
          missingErp += 1;
          const supplierHint = variant.supplierCode ? ` · réf. fournisseur ${variant.supplierCode}` : "";
          console.log(`⚠ ${variant.code}${supplierHint} : référence ERP absente, aucun prix modifié.`);
          continue;
        }
        const { record: erp, matchedRef } = resolvedErp;
        if (matchedRef !== variant.code.trim().toUpperCase()) aliasMatches += 1;
        const purchasePriceHT = Number(erp.costPrice);
        const sellingPriceHT = calculateAdeiSellingPriceHT(purchasePriceHT, rule.marginRate);
        if (sellingPriceHT === null) {
          console.log(`⚠ ${variant.code} : PA ERP non exploitable (${purchasePriceHT}).`);
          continue;
        }
        priceReady += 1;
        nextVariantPrices.push(sellingPriceHT);
        successfulVariantPrices += 1;

        const shipping = shippingFromAttributes(erp.attributes);
        const tripodShipping = rule.key === "TRIPODE" ? resolveAdeiTripodShipping(shipping) : null;
        if (tripodShipping?.reason === "UNDER_3M_MESSAGERIE") tripodMessagerieReady += 1;
        if (tripodShipping?.reason === "FROM_3M_AFFRETEMENT_C0") tripodAffretementC0Ready += 1;

        const aliasInfo = matchedRef !== variant.code.trim().toUpperCase() ? ` · ERP ${matchedRef}` : "";
        console.log(
          `• ${variant.code}${aliasInfo} · ${rule.marginRate}% · PA ${purchasePriceHT.toFixed(2)} € → PV ${sellingPriceHT.toFixed(2)} €` +
            (tripodShipping ? ` · ${tripodShipping.mode}${tripodShipping.affretementCoefficient === 0 ? " C0" : ""} (${shipping.weightKg} kg, ${shipping.packageLengthCm}×${shipping.packageWidthCm}×${shipping.packageHeightCm} cm)` : ""),
        );

        if (shouldApply) {
          await prisma.productVariant.update({
            where: { id: variant.id },
            data: {
              priceHt: sellingPriceHT,
              ...(shipping.weightKg ? { weightKg: shipping.weightKg } : {}),
              ...(shipping.packageLengthCm ? { packageLengthCm: shipping.packageLengthCm } : {}),
              ...(shipping.packageWidthCm ? { packageWidthCm: shipping.packageWidthCm } : {}),
              ...(shipping.packageHeightCm ? { packageHeightCm: shipping.packageHeightCm } : {}),
              ...(tripodShipping ? { shippingMode: tripodShipping.mode } : {}),
              sourceData: mergeSourceData(variant.sourceData, {
                purchasePriceHT,
                adeiPricing: { marginRate: rule.marginRate, calculatedSellingPriceHT: sellingPriceHT, updatedAt: new Date().toISOString() },
              }),
            },
          });
          updatedVariants += 1;
        }
      }
    } else {
      const resolvedErp = resolveErpRecord(erpByRef, product.code, product.supplierCode);
      if (!resolvedErp) {
        missingErp += 1;
        const supplierHint = product.supplierCode ? ` · réf. fournisseur ${product.supplierCode}` : "";
        console.log(`⚠ ${product.code}${supplierHint} : référence ERP absente, aucun prix modifié.`);
        continue;
      }
      const { record: erp } = resolvedErp;
      const purchasePriceHT = Number(erp.costPrice);
      const sellingPriceHT = calculateAdeiSellingPriceHT(purchasePriceHT, productRule.marginRate);
      if (sellingPriceHT !== null) {
        priceReady += 1;
        nextVariantPrices.push(sellingPriceHT);
        successfulVariantPrices = 1;
      }
    }

    const parentPricingComplete = product.variants.length
      ? successfulVariantPrices === product.variants.length
      : successfulVariantPrices === 1;

    if (shouldApply && nextVariantPrices.length && parentPricingComplete) {
      const min = Math.min(...nextVariantPrices);
      const max = Math.max(...nextVariantPrices);
      await prisma.product.update({
        where: { id: product.id },
        data: {
          priceHt: min,
          minPriceHt: min,
          maxPriceHt: max,
          sourceData: mergeSourceData(product.sourceData, {
            adeiPricing: { rule: productRule.key, marginRate: productRule.marginRate, updatedAt: new Date().toISOString() },
          }),
        },
      });
      updatedProducts += 1;
    }
  }

  console.log("\nRésumé");
  console.log(`- Fiches ADEI ciblées : ${targeted}`);
  console.log(`- Variantes/prix ERP exploitables : ${priceReady}`);
  console.log(`- Références ERP manquantes : ${missingErp}`);
  console.log(`- Correspondances via réf. fournisseur/alias ERP : ${aliasMatches}`);
  console.log(`- Tripodes < 3 m prêts MESSAGERIE : ${tripodMessagerieReady}`);
  console.log(`- Tripodes ≥ 3 m prêts AFFRETEMENT C0 : ${tripodAffretementC0Ready}`);
  console.log(`- Catégories ADEI volontairement non traitées : ${skippedCategories.size}`);
  for (const line of [...skippedCategories].slice(0, 20)) console.log(`  · ${line}`);

  if (!shouldApply) {
    console.log("\nDRY-RUN terminé : aucune donnée OYSTE modifiée.");
    console.log(`Pour appliquer : npx tsx scripts/apply-adei-commercial-rules.ts --confirm=${CONFIRMATION}`);
  } else {
    console.log(`\nApplication terminée : ${updatedVariants} variante(s), ${updatedProducts} parent(s) mis à jour.`);
  }
}

main()
  .catch((error) => {
    console.error("Mise à jour ADEI interrompue :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
