import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { prisma } from "../lib/db/prisma";

type SourceRow = {
  code: string;
  supplierCode: string | null;
  purchasePrice: number | null;
  sellingPrice: number | null;
  marginRate: number | null;
};

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value)
    .replace(/\u00a0/g, " ")
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/[^0-9.+-]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeHeader(value: unknown): string {
  return cleanText(value).toLowerCase().replace(/\s+/g, " ");
}

function findHeaderIndex(headers: unknown[], candidates: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const candidate of candidates) {
    const index = normalized.indexOf(normalizeHeader(candidate));
    if (index >= 0) return index;
  }
  return -1;
}

function findSourceWorkbook(): string {
  const explicit = process.env.KITO_CATALOGUE_SOURCE_XLSX;
  if (explicit) {
    const resolved = path.resolve(explicit);
    if (!fs.existsSync(resolved)) throw new Error(`Fichier source KITO introuvable : ${resolved}`);
    return resolved;
  }

  const candidates = [
    "Copie de BDD DATAPLUG FINAL (003).xlsx",
    "Copie de BDD DATAPLUG FINAL (003)(5).xlsx",
  ];
  for (const candidate of candidates) {
    const resolved = path.resolve(process.cwd(), candidate);
    if (fs.existsSync(resolved)) return resolved;
  }

  const fallback = fs.readdirSync(process.cwd())
    .filter((name) => /dataplug.*\.xlsx$/i.test(name))
    .map((name) => path.resolve(process.cwd(), name))[0];
  if (fallback) return fallback;

  throw new Error(
    "Source KITO historique introuvable. Place le fichier DATAPLUG à la racine ou renseigne KITO_CATALOGUE_SOURCE_XLSX.",
  );
}

function readKitoSource(filePath: string): Map<string, SourceRow[]> {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const sheet = workbook.Sheets.KITO;
  if (!sheet) throw new Error(`Onglet KITO introuvable dans ${path.basename(filePath)}`);

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    blankrows: false,
    raw: true,
  });
  const headers = rows[0] ?? [];

  const codeIdx = findHeaderIndex(headers, ["Code produit"]);
  const supplierCodeIdx = findHeaderIndex(headers, ["Code fournisseur"]);
  const purchaseIdx = findHeaderIndex(headers, ["Prix d'achats", "Prix d’achat", "Prix achat"]);
  const sellingIdx = findHeaderIndex(headers, ["Prix 1 HT"]);
  const marginIdx = findHeaderIndex(headers, ["Taux de marge %"]);

  if (codeIdx < 0 || purchaseIdx < 0) {
    throw new Error("Colonnes KITO requises introuvables : Code produit / Prix d'achats.");
  }

  const byCode = new Map<string, SourceRow[]>();
  for (const row of rows.slice(1)) {
    const code = cleanText(row[codeIdx]).toUpperCase();
    if (!code) continue;

    const record: SourceRow = {
      code,
      supplierCode: supplierCodeIdx >= 0 ? cleanText(row[supplierCodeIdx]) || null : null,
      purchasePrice: toNumber(row[purchaseIdx]),
      sellingPrice: sellingIdx >= 0 ? toNumber(row[sellingIdx]) : null,
      marginRate: marginIdx >= 0 ? toNumber(row[marginIdx]) : null,
    };
    const existing = byCode.get(code) ?? [];
    existing.push(record);
    byCode.set(code, existing);
  }
  return byCode;
}

async function main() {
  console.log("OYSTE — KITO — audit PA produit de base (source catalogue historique)\n");
  console.log("Mode : LECTURE SEULE — aucune modification BDD\n");

  const sourcePath = findSourceWorkbook();
  console.log(`Source : ${path.basename(sourcePath)} · onglet KITO\n`);
  const source = readKitoSource(sourcePath);

  const products = await prisma.product.findMany({
    where: { supplier: { name: { equals: "KITO", mode: "insensitive" } } },
    include: { variants: true },
    orderBy: { code: "asc" },
  });

  const variants = products.flatMap((product) =>
    product.variants.map((variant) => ({
      family: product.code,
      code: variant.code.toUpperCase(),
      currentSellingPrice: Number(variant.priceHt),
    })),
  );

  const familyStats = new Map<string, { total: number; matched: number; missing: number; invalidPa: number }>();
  let exact = 0;
  let missing = 0;
  let ambiguous = 0;
  let invalidPa = 0;
  let usable = 0;
  let pvMatches = 0;
  const missingRefs: string[] = [];
  const ambiguousRefs: string[] = [];
  const invalidPaRefs: string[] = [];
  const pvMismatchRefs: string[] = [];
  const margins = new Map<string, number>();

  for (const variant of variants) {
    const stat = familyStats.get(variant.family) ?? { total: 0, matched: 0, missing: 0, invalidPa: 0 };
    stat.total += 1;
    const rows = source.get(variant.code) ?? [];

    if (rows.length === 0) {
      missing += 1;
      stat.missing += 1;
      missingRefs.push(`${variant.family} / ${variant.code}`);
      familyStats.set(variant.family, stat);
      continue;
    }
    if (rows.length > 1) {
      ambiguous += 1;
      ambiguousRefs.push(`${variant.family} / ${variant.code} (${rows.length} lignes source)`);
      familyStats.set(variant.family, stat);
      continue;
    }

    exact += 1;
    stat.matched += 1;
    const row = rows[0];
    if (row.purchasePrice == null || row.purchasePrice <= 0) {
      invalidPa += 1;
      stat.invalidPa += 1;
      invalidPaRefs.push(`${variant.family} / ${variant.code}`);
      familyStats.set(variant.family, stat);
      continue;
    }

    usable += 1;
    if (row.marginRate != null) {
      const key = `${(row.marginRate * 100).toFixed(2)} %`;
      margins.set(key, (margins.get(key) ?? 0) + 1);
    }

    if (row.sellingPrice != null && Math.abs(row.sellingPrice - variant.currentSellingPrice) <= 0.011) {
      pvMatches += 1;
    } else if (row.sellingPrice != null) {
      pvMismatchRefs.push(
        `${variant.family} / ${variant.code} · OYSTE ${variant.currentSellingPrice.toFixed(2)} € · source ${row.sellingPrice.toFixed(2)} €`,
      );
    }

    familyStats.set(variant.family, stat);
  }

  console.log(`Familles KITO : ${products.length}`);
  console.log(`Variantes KITO : ${variants.length}`);
  console.log(`Correspondances exactes Code produit : ${exact}`);
  console.log(`Références source manquantes : ${missing}`);
  console.log(`Correspondances ambiguës : ${ambiguous}`);
  console.log(`PA nuls/non exploitables : ${invalidPa}`);
  console.log(`PA exploitables : ${usable}/${variants.length}`);
  console.log(`PV OYSTE = Prix 1 HT source : ${pvMatches}/${variants.length}`);

  if (margins.size) {
    console.log("\nTaux de marge présents dans la source :");
    for (const [rate, count] of Array.from(margins.entries()).sort()) {
      console.log(`- ${rate} : ${count} variante(s)`);
    }
  }

  console.log("\nPar famille :");
  for (const [family, stat] of Array.from(familyStats.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    const details: string[] = [];
    if (stat.missing) details.push(`${stat.missing} manquante(s)`);
    if (stat.invalidPa) details.push(`${stat.invalidPa} PA invalide(s)`);
    console.log(`- ${family}: ${stat.matched}/${stat.total} matchées${details.length ? ` · ${details.join(" · ")}` : ""}`);
  }

  if (missingRefs.length) {
    console.log("\nRéférences sans correspondance source :");
    for (const ref of missingRefs) console.log(`- ${ref}`);
  }
  if (ambiguousRefs.length) {
    console.log("\nRéférences ambiguës :");
    for (const ref of ambiguousRefs) console.log(`- ${ref}`);
  }
  if (invalidPaRefs.length) {
    console.log("\nRéférences avec PA nul/non exploitable :");
    for (const ref of invalidPaRefs) console.log(`- ${ref}`);
  }
  if (pvMismatchRefs.length) {
    console.log("\nÉcarts PV OYSTE / Prix 1 HT source :");
    for (const ref of pvMismatchRefs) console.log(`- ${ref}`);
  }

  console.log("\nAucune donnée modifiée.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
