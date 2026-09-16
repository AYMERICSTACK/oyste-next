import "dotenv/config";

import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/db/prisma";
import { calculateAdeiSellingPriceHT, getAdeiCommercialRule } from "../lib/pricing/adei-commercial-rules";
import { resolveAdeiTripodShipping } from "../lib/shipping/adei-tripod-shipping";

function normalize(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeRefCandidate(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[\\/]+/g, "_");
}

function refCandidates(code: string, supplierCode?: string | null) {
  const raw = [code, supplierCode].filter((v): v is string => Boolean(v?.trim()));
  const out: string[] = [];
  for (const value of raw) {
    const upper = value.trim().toUpperCase();
    const normalized = normalizeRefCandidate(value);
    const compact = upper.replace(/[^A-Z0-9]/g, "");
    for (const candidate of [upper, normalized, compact]) {
      if (candidate && !out.includes(candidate)) out.push(candidate);
    }
  }
  return out;
}

function resolveErpRecord<T>(map: Map<string, T>, code: string, supplierCode?: string | null) {
  for (const candidate of refCandidates(code, supplierCode)) {
    const row = map.get(candidate);
    if (row) return { row, matchedRef: candidate };
  }
  return null;
}

function positive(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function shippingFromAttributes(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  return {
    weightKg: positive(source.weightKg),
    packageLengthCm: positive(source.packageLengthCm),
    packageWidthCm: positive(source.packageWidthCm),
    packageHeightCm: positive(source.packageHeightCm),
  };
}

function money(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : NaN;
}

function sameMoney(a: unknown, b: unknown) {
  const aa = money(a);
  const bb = money(b);
  return Number.isFinite(aa) && Number.isFinite(bb) && Math.abs(aa - bb) < 0.005;
}

function sameNumber(a: unknown, b: unknown, tolerance = 0.001) {
  const aa = Number(a);
  const bb = Number(b);
  if (!Number.isFinite(aa) || !Number.isFinite(bb)) return false;
  return Math.abs(aa - bb) <= tolerance;
}

async function main() {
  const supplier = await prisma.supplier.findFirst({
    where: { name: { equals: "ADEI", mode: "insensitive" } },
    select: { id: true, name: true, isActive: true },
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

  const erpByRef = new Map(erpRows.map((row) => [normalize(row.ref), row]));

  let targetedParents = 0;
  let targetedVariants = 0;
  let exactPrice = 0;
  let priceMismatch = 0;
  let missingErp = 0;
  let invalidPa = 0;
  let aliasMatches = 0;
  let transportChecked = 0;
  let transportMismatch = 0;
  let shippingDataMismatch = 0;
  let parentRangeMismatch = 0;
  let untouchedParents = 0;

  const anomalies: string[] = [];
  const skipped: string[] = [];

  console.log("\nOYSTE — AUDIT ADEI LECTURE SEULE");
  console.log("---------------------------------");
  console.log(`Fournisseur : ${supplier.name} · actif=${supplier.isActive}`);
  console.log(`Produits ADEI : ${products.length}`);
  console.log(`Enregistrements ERP actifs : ${erpRows.length}`);
  console.log("AUCUNE ÉCRITURE BDD : ce script est strictement en lecture seule.\n");

  for (const product of products) {
    const categoryPath = product.category?.path || product.category?.name || "";
    const productRule = getAdeiCommercialRule({
      code: product.code,
      name: product.name,
      categoryPath,
    });

    if (!productRule) {
      untouchedParents += 1;
      skipped.push(`${product.code} — ${product.name}`);
      continue;
    }

    targetedParents += 1;
    const expectedVariantPrices: number[] = [];
    let productComplete = true;

    const rows = product.variants.length
      ? product.variants.map((variant) => ({
          kind: "VARIANT" as const,
          id: variant.id,
          code: variant.code,
          supplierCode: variant.supplierCode,
          name: `${product.name} ${variant.name || ""}`,
          priceHt: variant.priceHt,
          weightKg: variant.weightKg,
          packageLengthCm: variant.packageLengthCm,
          packageWidthCm: variant.packageWidthCm,
          packageHeightCm: variant.packageHeightCm,
          shippingMode: variant.shippingMode,
        }))
      : [{
          kind: "PRODUCT" as const,
          id: product.id,
          code: product.code,
          supplierCode: product.supplierCode,
          name: product.name,
          priceHt: product.priceHt,
          weightKg: product.weightKg,
          packageLengthCm: product.packageLengthCm,
          packageWidthCm: product.packageWidthCm,
          packageHeightCm: product.packageHeightCm,
          shippingMode: product.shippingMode,
        }];

    for (const item of rows) {
      targetedVariants += 1;
      const rule = getAdeiCommercialRule({
        code: item.code,
        name: item.name,
        categoryPath,
      }) || productRule;

      const resolved = resolveErpRecord(erpByRef, item.code, item.supplierCode);
      if (!resolved) {
        missingErp += 1;
        productComplete = false;
        anomalies.push(`ERP ABSENT · ${item.code}${item.supplierCode ? ` · fournisseur ${item.supplierCode}` : ""}`);
        continue;
      }

      const { row: erp, matchedRef } = resolved;
      if (matchedRef !== normalize(item.code)) aliasMatches += 1;

      const pa = Number(erp.costPrice);
      const expectedPv = calculateAdeiSellingPriceHT(pa, rule.marginRate);
      if (expectedPv === null) {
        invalidPa += 1;
        productComplete = false;
        anomalies.push(`PA INVALIDE · ${item.code} · ERP ${pa}`);
        continue;
      }

      expectedVariantPrices.push(expectedPv);

      if (sameMoney(item.priceHt, expectedPv)) {
        exactPrice += 1;
      } else {
        priceMismatch += 1;
        anomalies.push(
          `PRIX · ${item.code} · marge ${rule.marginRate}% · PA ${pa.toFixed(2)} · actuel ${money(item.priceHt).toFixed(2)} · attendu ${expectedPv.toFixed(2)} · écart ${(money(item.priceHt) - expectedPv).toFixed(2)}`,
        );
      }

      const erpShipping = shippingFromAttributes(erp.attributes);
      for (const [label, current, expected] of [
        ["poids", item.weightKg, erpShipping.weightKg],
        ["L", item.packageLengthCm, erpShipping.packageLengthCm],
        ["l", item.packageWidthCm, erpShipping.packageWidthCm],
        ["H", item.packageHeightCm, erpShipping.packageHeightCm],
      ] as const) {
        if (expected !== undefined && !sameNumber(current, expected)) {
          shippingDataMismatch += 1;
          anomalies.push(`DATA TRANSPORT · ${item.code} · ${label} actuel=${current ?? "null"} · ERP=${expected}`);
        }
      }

      if (rule.key === "TRIPODE") {
        const expectedShipping = resolveAdeiTripodShipping(erpShipping);
        if (expectedShipping) {
          transportChecked += 1;
          if (String(item.shippingMode) !== expectedShipping.mode) {
            transportMismatch += 1;
            anomalies.push(
              `MODE TRANSPORT · ${item.code} · actuel=${item.shippingMode} · attendu=${expectedShipping.mode}${expectedShipping.affretementCoefficient === 0 ? " C0" : ""}`,
            );
          }
        }
      }
    }

    if (expectedVariantPrices.length && productComplete) {
      const expectedMin = Math.min(...expectedVariantPrices);
      const expectedMax = Math.max(...expectedVariantPrices);
      const parentProblems: string[] = [];
      if (!sameMoney(product.priceHt, expectedMin)) parentProblems.push(`priceHt ${money(product.priceHt).toFixed(2)}→${expectedMin.toFixed(2)}`);
      if (!sameMoney(product.minPriceHt, expectedMin)) parentProblems.push(`min ${money(product.minPriceHt).toFixed(2)}→${expectedMin.toFixed(2)}`);
      if (!sameMoney(product.maxPriceHt, expectedMax)) parentProblems.push(`max ${money(product.maxPriceHt).toFixed(2)}→${expectedMax.toFixed(2)}`);
      if (parentProblems.length) {
        parentRangeMismatch += 1;
        anomalies.push(`PARENT · ${product.code} · ${parentProblems.join(" · ")}`);
      }
    }
  }

  console.log("Résumé");
  console.log(`- Parents ADEI ciblés par les règles : ${targetedParents}`);
  console.log(`- Lignes/variantes contrôlées : ${targetedVariants}`);
  console.log(`- Prix exactement conformes : ${exactPrice}`);
  console.log(`- Écarts de prix : ${priceMismatch}`);
  console.log(`- Références ERP absentes : ${missingErp}`);
  console.log(`- PA ERP invalides : ${invalidPa}`);
  console.log(`- Correspondances via alias/réf. fournisseur : ${aliasMatches}`);
  console.log(`- Écarts poids/dimensions vs ERP : ${shippingDataMismatch}`);
  console.log(`- Tripodes avec décision transport contrôlable : ${transportChecked}`);
  console.log(`- Écarts de mode transport tripode : ${transportMismatch}`);
  console.log(`- Parents avec min/max/prix incohérents : ${parentRangeMismatch}`);
  console.log(`- Parents ADEI volontairement hors règles : ${untouchedParents}`);

  if (skipped.length) {
    console.log("\nHors règles commerciales (aucune conclusion tarifaire) :");
    for (const line of skipped.slice(0, 40)) console.log(`- ${line}`);
    if (skipped.length > 40) console.log(`... +${skipped.length - 40} autre(s)`);
  }

  if (anomalies.length) {
    console.log(`\nANOMALIES (${anomalies.length})`);
    console.log("---------------------------------");
    for (const line of anomalies) console.log(line);
  } else {
    console.log("\nAucune anomalie détectée sur le périmètre contrôlable.");
  }

  console.log("\nAudit terminé. Aucune donnée n'a été modifiée.");
}

main()
  .catch((error) => {
    console.error("Audit ADEI interrompu :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
