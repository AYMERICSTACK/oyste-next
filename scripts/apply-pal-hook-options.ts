import "dotenv/config";

import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/db/prisma";
import { calculateAdeiSellingPriceHT } from "../lib/pricing/adei-commercial-rules";

const CONFIRMATION = "APPLY-PAL-HOOK-OPTIONS";
const shouldApply = process.argv.includes(`--confirm=${CONFIRMATION}`);
const TARGETS = [
  { productCode: "PALFIX", erpPrefix: "PALECOF" },
  { productCode: "PALREG", erpPrefix: "PALECOR" },
] as const;
const MARGIN_RATE = 23;

type ErpAttributes = {
  weightKg?: number;
  packageLengthCm?: number;
  packageWidthCm?: number;
  packageHeightCm?: number;
};

function normalizeErpRef(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[\\/]+/g, "_");
}

function formatErpMeasure(value: string, suffix = "") {
  const number = Number(value);
  const formatted = Number.isInteger(number) ? String(number) : String(number).replace(".", ",");
  return `${formatted}${suffix}`;
}

function palonnierOptionsFromErpRef(reference: string) {
  const ref = normalizeErpRef(reference);
  const fixed = ref.match(/^PALECOF(\d+(?:\.\d+)?)T_(\d+(?:\.\d+)?)_(AC|SC)$/);
  if (fixed) {
    return {
      CMU: `${Math.round(Number(fixed[1]) * 1000)}kg`,
      "Longueur entre crochets": formatErpMeasure(fixed[2], " m"),
      Crochets: fixed[3] === "AC" ? "Avec" : "Sans",
    };
  }
  const adjustable = ref.match(/^PALECOR(\d+(?:\.\d+)?)T_(\d+(?:\.\d+)?)_(\d+(?:\.\d+)?)_(AC|SC)$/);
  if (adjustable) {
    return {
      CMU: `${Math.round(Number(adjustable[1]) * 1000)}kg`,
      "Longueur entre crochets": `${formatErpMeasure(adjustable[2], "m")} à ${formatErpMeasure(adjustable[3], "m")}`,
      Crochets: adjustable[4] === "AC" ? "Avec" : "Sans",
    };
  }
  return null;
}

function supplierCodeFromErpRef(value: string) {
  return value.replace(/_/g, "/");
}

function positive(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function erpShipping(value: Prisma.JsonValue | null): ErpAttributes {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  return {
    weightKg: positive(source.weightKg),
    packageLengthCm: positive(source.packageLengthCm),
    packageWidthCm: positive(source.packageWidthCm),
    packageHeightCm: positive(source.packageHeightCm),
  };
}

function asStringRecord(value: Prisma.JsonValue | null): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
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

function buildLabel(options: Record<string, string>) {
  return Object.entries(options).map(([label, value]) => `${label} ${value}`).join(" · ");
}

function mergedFeatures(
  current: Array<{ label: string; value: string; sortOrder: number }>,
  options: Record<string, string>,
) {
  const byLabel = new Map(current.map((feature) => [feature.label, feature.value]));
  Object.entries(options).forEach(([label, value]) => byLabel.set(label, value));
  const preferred = ["CMU", "Longueur entre crochets", "Crochets"];
  const labels = [...preferred, ...Array.from(byLabel.keys()).filter((label) => !preferred.includes(label))];
  return labels.filter((label) => byLabel.has(label)).map((label, sortOrder) => ({
    label,
    value: byLabel.get(label) || "",
    sortOrder,
  }));
}

async function main() {
  console.log("\nOYSTE — PALFIX/PALREG — option avec/sans crochets");
  console.log("--------------------------------------------------");
  console.log(`Mode : ${shouldApply ? "APPLICATION" : "DRY-RUN"}`);
  console.log("Source prix : ERP actif · marge palonniers 23 % sur prix de vente.");
  console.log("Le script ne supprime aucune variante existante.\n");

  let totalAc = 0;
  let totalScReady = 0;
  let totalMissing = 0;
  let totalCreated = 0;
  let totalUpdatedAc = 0;

  for (const target of TARGETS) {
    const product = await prisma.product.findFirst({
      where: { code: { equals: target.productCode, mode: "insensitive" } },
      include: {
        variants: {
          orderBy: { code: "asc" },
          include: { features: { orderBy: { sortOrder: "asc" } } },
        },
      },
    });

    if (!product) {
      console.log(`⚠ ${target.productCode} : produit parent introuvable.`);
      continue;
    }

    const erpRows = await prisma.erpProductRecord.findMany({
      where: {
        isActive: true,
        ref: { startsWith: target.erpPrefix },
      },
      select: { ref: true, label: true, costPrice: true, attributes: true },
    });
    const erpByRef = new Map(erpRows.map((row) => [row.ref.trim().toUpperCase(), row]));

    const acVariants = product.variants.filter((variant) =>
      normalizeErpRef(variant.supplierCode).endsWith("_AC"),
    );

    console.log(`${target.productCode} : ${acVariants.length} variante(s) avec crochets trouvée(s).`);
    totalAc += acVariants.length;

    for (const acVariant of acVariants) {
      const acErpRef = normalizeErpRef(acVariant.supplierCode);
      const scErpRef = acErpRef.replace(/_AC$/, "_SC");
      const scErp = erpByRef.get(scErpRef);
      if (!scErp) {
        totalMissing += 1;
        console.log(`  ⚠ ${acVariant.code} → ${scErpRef} absent de l'ERP actif.`);
        continue;
      }

      const sellingPrice = calculateAdeiSellingPriceHT(Number(scErp.costPrice), MARGIN_RATE);
      if (sellingPrice === null) {
        totalMissing += 1;
        console.log(`  ⚠ ${scErpRef} : prix d'achat ERP inexploitable.`);
        continue;
      }

      totalScReady += 1;
      const scCode = `${acVariant.code}SC`;
      const acOptions = palonnierOptionsFromErpRef(acErpRef) || { ...asStringRecord(acVariant.options), Crochets: "Avec" };
      const scOptions = palonnierOptionsFromErpRef(scErpRef) || { ...acOptions, Crochets: "Sans" };
      const shipping = erpShipping(scErp.attributes);
      const baseName = acVariant.name.replace(/\s+(avec|sans)\s+crochets?\s*$/i, "").trim();

      console.log(
        `  • ${acVariant.code} / ${scCode} · ERP ${scErpRef} · PA ${Number(scErp.costPrice).toFixed(2)} € → PV ${sellingPrice.toFixed(2)} €`,
      );

      if (!shouldApply) continue;

      await prisma.$transaction(async (tx) => {
        await tx.productVariant.update({
          where: { id: acVariant.id },
          data: {
            options: acOptions,
            label: buildLabel(acOptions),
            sourceData: mergeSourceData(acVariant.sourceData, {
              hookConfiguration: "WITH_HOOKS",
              erpReference: acErpRef,
            }),
          },
        });
        await tx.productVariantFeature.deleteMany({ where: { variantId: acVariant.id } });
        const correctedAcFeatures = mergedFeatures(acVariant.features, acOptions);
        await tx.productVariantFeature.createMany({
          data: correctedAcFeatures.map((feature) => ({ ...feature, variantId: acVariant.id })),
        });
        totalUpdatedAc += 1;

        const existingSc = await tx.productVariant.findFirst({
          where: {
            productId: product.id,
            code: { equals: scCode, mode: "insensitive" },
          },
          select: { id: true },
        });

        const scData = {
          productId: product.id,
          code: scCode,
          supplierCode: supplierCodeFromErpRef(scErpRef),
          name: `${baseName} sans crochets`,
          label: buildLabel(scOptions),
          priceHt: sellingPrice,
          stock: 0,
          ...(shipping.weightKg ? { weightKg: shipping.weightKg } : {}),
          ...(shipping.packageLengthCm ? { packageLengthCm: shipping.packageLengthCm } : {}),
          ...(shipping.packageWidthCm ? { packageWidthCm: shipping.packageWidthCm } : {}),
          ...(shipping.packageHeightCm ? { packageHeightCm: shipping.packageHeightCm } : {}),
          shippingMode: acVariant.shippingMode,
          leadTime: acVariant.leadTime,
          imageReference: acVariant.imageReference,
          options: scOptions,
          sourceData: mergeSourceData(acVariant.sourceData, {
            code: scCode,
            supplierCode: supplierCodeFromErpRef(scErpRef),
            name: `${baseName} sans crochets`,
            options: scOptions,
            hookConfiguration: "WITHOUT_HOOKS",
            erpReference: scErpRef,
            purchasePriceHT: Number(scErp.costPrice),
            adeiPricing: {
              marginRate: MARGIN_RATE,
              calculatedSellingPriceHT: sellingPrice,
              updatedAt: new Date().toISOString(),
            },
          }),
        } satisfies Omit<Prisma.ProductVariantUncheckedCreateInput, "id">;

        let scVariantId: string;
        if (existingSc) {
          await tx.productVariant.update({ where: { id: existingSc.id }, data: scData });
          scVariantId = existingSc.id;
        } else {
          const created = await tx.productVariant.create({
            data: {
              id: `${product.id}::${scCode}`,
              ...scData,
            },
            select: { id: true },
          });
          scVariantId = created.id;
          totalCreated += 1;
        }

        await tx.productVariantFeature.deleteMany({ where: { variantId: scVariantId } });
        const scFeatures = mergedFeatures(acVariant.features, scOptions);
        await tx.productVariantFeature.createMany({
          data: scFeatures.map((feature) => ({ ...feature, variantId: scVariantId })),
        });
      });
    }

    if (shouldApply) {
      const refreshed = await prisma.productVariant.findMany({
        where: { productId: product.id },
        select: { priceHt: true },
      });
      const prices = refreshed.map((variant) => Number(variant.priceHt)).filter((price) => Number.isFinite(price) && price > 0);
      const currentSchema = Array.isArray(product.optionSchema)
        ? (product.optionSchema as Array<{ label?: unknown; values?: unknown }>).flatMap((option) =>
            typeof option?.label === "string" && Array.isArray(option.values)
              ? [{ label: option.label, values: option.values.filter((value): value is string => typeof value === "string") }]
              : [],
          )
        : [];
      const optionSchema = [
        ...currentSchema.filter((option) => option.label !== "Crochets"),
        { label: "Crochets", values: ["Avec", "Sans"] },
      ];

      await prisma.product.update({
        where: { id: product.id },
        data: {
          optionSchema,
          ...(prices.length
            ? {
                priceHt: Math.min(...prices),
                minPriceHt: Math.min(...prices),
                maxPriceHt: Math.max(...prices),
              }
            : {}),
          sourceData: mergeSourceData(product.sourceData, {
            hookOptions: {
              enabled: true,
              values: ["Avec", "Sans"],
              source: "ERP PALECOF/PALECOR",
              updatedAt: new Date().toISOString(),
            },
          }),
        },
      });
    }
  }

  console.log("\nRésumé");
  console.log(`- Variantes AC analysées : ${totalAc}`);
  console.log(`- Variantes SC ERP prêtes : ${totalScReady}`);
  console.log(`- Références/prix manquants : ${totalMissing}`);

  if (!shouldApply) {
    console.log("\nDRY-RUN terminé : aucune donnée OYSTE modifiée.");
    console.log(`Pour appliquer : npx tsx scripts/apply-pal-hook-options.ts --confirm=${CONFIRMATION}`);
  } else {
    console.log(`- Variantes AC enrichies : ${totalUpdatedAc}`);
    console.log(`- Nouvelles variantes SC créées : ${totalCreated}`);
    console.log("\nApplication terminée.");
  }
}

main()
  .catch((error) => {
    console.error("Mise à jour PALFIX/PALREG interrompue :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
