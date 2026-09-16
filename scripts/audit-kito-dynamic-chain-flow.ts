import "dotenv/config";

import { prisma } from "../lib/db/prisma";
import { getKitoChainWeightRule } from "../lib/shipping/kito-chain-weight";

type Hit = { path: string; label: string; value: string; meters: number | null };

function parseMeters(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  const text = String(value ?? "").trim().toLowerCase().replace(/,/g, ".");
  if (!text) return null;
  const m = text.match(/(-?\d+(?:\.\d+)?)\s*m(?:\b|$)/i) || text.match(/^(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isLiftLabel(label: string) {
  const s = label.toLowerCase();
  return (
    s.includes("hauteur de levage") ||
    s.includes("hauteur levage") ||
    s.includes("hauteur de levee") ||
    s.includes("hauteur de levée") ||
    s.includes("longueur de chaine") ||
    s.includes("longueur de chaîne") ||
    s === "lift" ||
    s.includes("lifting height") ||
    s.includes("lift height") ||
    s.includes("standard lift")
  );
}

function scalar(value: unknown) {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function inspect(value: unknown, path = "root", inheritedLabel = "", hits: Hit[] = []): Hit[] {
  if (value == null) return hits;

  if (Array.isArray(value)) {
    value.forEach((entry, index) => inspect(entry, `${path}[${index}]`, inheritedLabel, hits));
    return hits;
  }

  if (typeof value !== "object") return hits;
  const obj = value as Record<string, unknown>;

  // Formes courantes { label, value }, { name, value }, { key, value }
  const labelCandidate = [obj.label, obj.name, obj.key, obj.title].find((v) => typeof v === "string") as string | undefined;
  if (labelCandidate && "value" in obj && scalar(obj.value) && isLiftLabel(labelCandidate)) {
    hits.push({ path, label: labelCandidate, value: String(obj.value), meters: parseMeters(obj.value) });
  }

  for (const [key, child] of Object.entries(obj)) {
    if (scalar(child) && isLiftLabel(key)) {
      hits.push({ path: `${path}.${key}`, label: key, value: String(child), meters: parseMeters(child) });
      continue;
    }
    inspect(child, `${path}.${key}`, labelCandidate || inheritedLabel, hits);
  }

  return hits;
}

function uniqHits(hits: Hit[]) {
  const seen = new Set<string>();
  return hits.filter((h) => {
    const k = `${h.path}|${h.label}|${h.value}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function fmtWeight(v: unknown) {
  return v == null ? "MANQUANT" : `${Number(v)} kg`;
}

async function main() {
  const supplier = await prisma.supplier.findFirst({
    where: { name: { equals: "KITO", mode: "insensitive" } },
    select: { id: true },
  });
  if (!supplier) throw new Error("Fournisseur KITO introuvable.");

  const products = await prisma.product.findMany({
    where: { supplierId: supplier.id },
    orderBy: { code: "asc" },
    select: {
      code: true,
      name: true,
      weightKg: true,
      optionSchema: true,
      sourceData: true,
      variants: {
        orderBy: { code: "asc" },
        select: {
          code: true,
          name: true,
          label: true,
          weightKg: true,
          options: true,
          sourceData: true,
        },
      },
    },
  });

  console.log("\nOYSTE — KITO V2.12.13.7.1");
  console.log("---------------------------");
  console.log("Mode : AUDIT LECTURE SEULE — aucune modification BDD");
  console.log("Objectif : vérifier si une hauteur de levage exploitable arrive depuis les données catalogue KITO.\n");

  let totalVariants = 0;
  let withRule = 0;
  let withWeight = 0;
  let withDetectedLift = 0;
  let fullyReady = 0;
  let ruleButNoLift = 0;
  let liftButNoRule = 0;
  let liftButNoWeight = 0;

  for (const product of products) {
    const parentHits = uniqHits([
      ...inspect(product.optionSchema, "product.optionSchema"),
      ...inspect(product.sourceData, "product.sourceData"),
    ]);

    let printedParent = false;
    for (const variant of product.variants) {
      totalVariants += 1;
      const rule = getKitoChainWeightRule(variant.code);
      const weight = variant.weightKg != null ? Number(variant.weightKg) : product.weightKg != null ? Number(product.weightKg) : null;
      const hits = uniqHits([
        ...inspect(variant.options, "variant.options"),
        ...inspect(variant.sourceData, "variant.sourceData"),
        ...parentHits,
      ]);
      const validLiftHits = hits.filter((h) => h.meters != null);

      if (rule) withRule += 1;
      if (weight != null && Number.isFinite(weight) && weight > 0) withWeight += 1;
      if (validLiftHits.length) withDetectedLift += 1;
      if (rule && weight != null && weight > 0 && validLiftHits.length) fullyReady += 1;
      if (rule && !validLiftHits.length) ruleButNoLift += 1;
      if (!rule && validLiftHits.length) liftButNoRule += 1;
      if (rule && validLiftHits.length && !(weight != null && weight > 0)) liftButNoWeight += 1;

      if (!printedParent) {
        console.log(`[PARENT] ${product.code} · ${product.name}`);
        printedParent = true;
      }

      const ruleText = rule ? `base=${rule.baseLiftM} m · +${rule.additionalWeightPerMeterKg} kg/m` : "AUCUNE";
      const liftText = validLiftHits.length
        ? validLiftHits.map((h) => `${h.label}=${h.value} [${h.path}]`).join(" | ")
        : "NON DÉTECTÉE";
      const status = rule && weight && validLiftHits.length ? "PRÊT" : rule && !validLiftHits.length ? "BLOQUÉ: HAUTEUR ABSENTE" : !rule && validLiftHits.length ? "HAUTEUR PRÉSENTE / PAS DE RÈGLE" : rule && validLiftHits.length && !weight ? "BLOQUÉ: POIDS ABSENT" : "NON CONCERNÉ";

      console.log(`  ${status} · ${variant.code} · poids=${fmtWeight(weight)} · règle=${ruleText} · hauteur=${liftText}`);
    }
    console.log("");
  }

  console.log("Résumé");
  console.log(`- Fiches KITO : ${products.length}`);
  console.log(`- Variantes KITO : ${totalVariants}`);
  console.log(`- Variantes avec règle poids chaîne : ${withRule}`);
  console.log(`- Variantes avec poids de base exploitable : ${withWeight}`);
  console.log(`- Variantes avec hauteur détectable dans les données catalogue : ${withDetectedLift}`);
  console.log(`- Variantes totalement prêtes au calcul dynamique : ${fullyReady}`);
  console.log(`- Avec règle chaîne mais hauteur absente : ${ruleButNoLift}`);
  console.log(`- Hauteur présente mais aucune règle chaîne : ${liftButNoRule}`);
  console.log(`- Règle + hauteur mais poids de base absent : ${liftButNoWeight}`);
  console.log("- Aucune donnée modifiée.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
