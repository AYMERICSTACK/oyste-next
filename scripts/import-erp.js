#!/usr/bin/env node
/*
 * V6.1 ERP Foundation importer
 * Usage:
 *   npm run import:erp
 *   npm run import:erp -- ./export_ouvrages_2026.ods
 *
 * This script is deliberately self-contained CommonJS because it must run with
 * plain Node on Windows. The TypeScript ERP layer is used by Next/React after
 * the JSON snapshot has been generated.
 */
const fs = require("node:fs");
const path = require("node:path");

const REQUIRED_SHEETS = {
  ouvrages: ["export_ouvrage", "export_ouvrages"],
  details: ["export_det", "export_details"],
  products: ["export_produits", "export_produit"],
  joined: ["ouvrage+det", "ouvrage_det", "ouvragedet"],
};

const FAMILY_DEFINITIONS = [
  { code: "PFI", category: "potence", label: "Potence sur fût inversée", match: /^PFI/ },
  { code: "PFT", category: "potence", label: "Potence sur fût triangulée", match: /^PFT/ },
  { code: "PMI", category: "potence", label: "Potence murale inversée", match: /^PMI/ },
  { code: "PMT", category: "potence", label: "Potence murale triangulée", match: /^PMT/ },
  { code: "PORT", category: "portique", label: "Portique acier déplaçable", match: /^PORT/ },
  { code: "CB", category: "palan", label: "Palan manuel à chaîne KITO CB", match: /^CB\d+/ },
];

function normalizeSheetName(name) {
  return String(name).trim().toLowerCase().replace(/\s+/g, "_");
}

function findSheetName(workbook, aliases) {
  const normalizedAliases = aliases.map(normalizeSheetName);
  return workbook.SheetNames.find((sheetName) => normalizedAliases.includes(normalizeSheetName(sheetName)));
}

function assertSheet(workbook, key) {
  const sheetName = findSheetName(workbook, REQUIRED_SHEETS[key]);
  if (!sheetName) {
    throw new Error(`Feuille ERP introuvable pour ${key}. Feuilles disponibles: ${workbook.SheetNames.join(", ")}`);
  }
  return sheetName;
}

function getString(row, ...keys) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function getNumber(row, ...keys) {
  const value = getString(row, ...keys).replace(",", ".");
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCode(value) {
  return String(value ?? "").trim();
}

function normalizeReference(reference) {
  return normalizeCode(reference).toUpperCase().replace(/\s+/g, "");
}

function isTruthyCode(value) {
  return value.length > 0 && value.toLowerCase() !== "nan";
}

function parseNumber(value) {
  if (!value) return undefined;
  const parsed = Number.parseFloat(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseChargeFromLabel(label) {
  const match = String(label ?? "").match(/(\d+(?:[,.]\d+)?)\s*kg/i);
  const value = parseNumber(match?.[1]);
  return value === undefined ? undefined : Math.round(value);
}

function parseReachFromLabel(label) {
  const match = String(label ?? "").match(/port[ée]e?\s*:??\s*(\d+(?:[,.]\d+)?)\s*m/i);
  const value = parseNumber(match?.[1]);
  return value === undefined ? undefined : Math.round(value * 1000);
}

function parsePotence(reference, label) {
  const ref = normalizeReference(reference);
  const family = ref.slice(0, 3);
  const compact = ref.match(/^(PFI|PFT|PMI|PMT)(\d+)(\d{4})$/);
  const ouvrage = ref.match(/^(PFI|PFT|PMI|PMT)(\d+)KG(\d+)MM$/);
  const rawCharge = compact?.[2] ?? ouvrage?.[2];
  const rawReach = compact?.[3] ?? ouvrage?.[3];

  return {
    family,
    category: "potence",
    installation: family.startsWith("PF") ? "fut" : "murale",
    conception: family.endsWith("I") ? "inversee" : "triangulee",
    chargeKg: rawCharge ? Number.parseInt(rawCharge, 10) : parseChargeFromLabel(label),
    reachMm: rawReach ? Number.parseInt(rawReach, 10) : parseReachFromLabel(label),
  };
}

function parsePortique(reference, label) {
  const ref = normalizeReference(reference);
  const match = ref.match(/^PORT(\d+)(\d{4})(\d{4})$/);
  return {
    family: "PORT",
    category: "portique",
    chargeKg: match?.[1] ? Number.parseInt(match[1], 10) : parseChargeFromLabel(label),
    spanMm: match?.[2] ? Number.parseInt(match[2], 10) : undefined,
    heightMm: match?.[3] ? Number.parseInt(match[3], 10) : undefined,
  };
}

function parsePalan(reference, label) {
  const ref = normalizeReference(reference);
  return {
    family: ref.match(/^[A-Z]+/)?.[0] ?? ref,
    category: "palan",
    chargeKg: parseChargeFromLabel(label),
  };
}

function parseGeneric(reference) {
  const ref = normalizeReference(reference);
  return {
    family: ref.match(/^[A-Z]+/)?.[0] ?? ref,
    category: "produit",
  };
}

function parseErpReference(reference, label) {
  const ref = normalizeReference(reference);
  const definition = FAMILY_DEFINITIONS.find((item) => item.match.test(ref));
  if (!definition) return parseGeneric(reference);
  if (definition.code === "PORT") return parsePortique(reference, label);
  if (["PFI", "PFT", "PMI", "PMT"].includes(definition.code)) return parsePotence(reference, label);
  if (definition.category === "palan") return parsePalan(reference, label);
  return parseGeneric(reference);
}

function getFamilyLabel(code, category) {
  const definition = FAMILY_DEFINITIONS.find((item) => item.code === code);
  if (definition) return definition.label;
  if (category === "portique") return "Portiques";
  if (category === "potence") return "Potences";
  if (category === "palan") return "Palans";
  if (category === "accessoire") return "Accessoires";
  return code;
}

function getOptionalNumber(row, ...keys) {
  const raw = getString(row, ...keys);
  if (!raw) return undefined;
  const parsed = Number.parseFloat(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function convertWeightToKg(value, unitPower) {
  if (value === undefined || value <= 0 || unitPower === undefined) return undefined;
  return value * Math.pow(10, unitPower);
}

function convertLengthToCm(value, unitPower) {
  if (value === undefined || value <= 0 || unitPower === undefined) return undefined;
  return value * Math.pow(10, unitPower + 2);
}

function parseTransportDataFromDescription(description) {
  const text = String(description ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&times;/gi, "x")
    .replace(/&#215;/gi, "x")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ");

  const weightMatch = text.match(/Poids\s*=\s*(\d+(?:[,.]\d+)?)\s*kg/i);
  const dimensionsMatch = text.match(
    /Dimensions?\s+(?:pour\s+)?transport\s*=\s*(\d+(?:[,.]\d+)?)\s*[x×]\s*(\d+(?:[,.]\d+)?)\s*[x×]\s*(\d+(?:[,.]\d+)?)\s*(mm|cm|m)\b/i,
  );

  const weightKg = parseNumber(weightMatch?.[1]);
  if (!dimensionsMatch) return { weightKg };

  const factorToCm = dimensionsMatch[4].toLowerCase() === "mm"
    ? 0.1
    : dimensionsMatch[4].toLowerCase() === "m"
      ? 100
      : 1;

  return {
    weightKg,
    packageLengthCm: parseNumber(dimensionsMatch[1]) * factorToCm,
    packageWidthCm: parseNumber(dimensionsMatch[2]) * factorToCm,
    packageHeightCm: parseNumber(dimensionsMatch[3]) * factorToCm,
  };
}

function normalizeProduct(row) {
  const ref = normalizeCode(getString(row, "ref", "Ref", "REF"));
  if (!isTruthyCode(ref)) return null;
  const label = getString(row, "label", "Label", "LABEL") || ref;
  const parsed = parseErpReference(ref, label);
  const rawWeight = getOptionalNumber(row, "weight", "Weight", "poids", "Poids");
  const rawWeightUnit = getOptionalNumber(row, "weight_units", "WeightUnits", "poids_unite");
  const rawLength = getOptionalNumber(row, "length", "Length", "longueur", "Longueur");
  const rawWidth = getOptionalNumber(row, "width", "Width", "largeur", "Largeur");
  const rawHeight = getOptionalNumber(row, "height", "Height", "hauteur", "Hauteur");
  const rawLengthUnit = getOptionalNumber(row, "length_units", "LengthUnits", "size_units");
  const rawWidthUnit = getOptionalNumber(row, "width_units", "WidthUnits") ?? rawLengthUnit;
  const rawHeightUnit = getOptionalNumber(row, "height_units", "HeightUnits") ?? rawLengthUnit;
  const description = getString(row, "description", "Description") || undefined;
  const descriptionShipping = parseTransportDataFromDescription(description);
  return {
    ref,
    label,
    description,
    costPrice: getNumber(row, "cost_price", "costPrice", "Cost_price", "price", "Prix"),
    family: parsed.family,
    category: parsed.category,
    installation: parsed.installation,
    conception: parsed.conception,
    chargeKg: parsed.chargeKg,
    reachMm: parsed.reachMm,
    spanMm: parsed.spanMm,
    heightMm: parsed.heightMm,
    widthMm: parsed.widthMm,
    weightKg: convertWeightToKg(rawWeight, rawWeightUnit) ?? descriptionShipping.weightKg,
    packageLengthCm: convertLengthToCm(rawLength, rawLengthUnit) ?? descriptionShipping.packageLengthCm,
    packageWidthCm: convertLengthToCm(rawWidth, rawWidthUnit) ?? descriptionShipping.packageWidthCm,
    packageHeightCm: convertLengthToCm(rawHeight, rawHeightUnit) ?? descriptionShipping.packageHeightCm,
  };
}

function normalizeJoinedComponent(row) {
  const ouvrageCode = normalizeCode(getString(row, "Ouvrage", "ouvrage", "ref", "Ref"));
  const componentCode = normalizeCode(getString(row, "Composant", "composant", "component", "Component"));
  if (!isTruthyCode(ouvrageCode) || !isTruthyCode(componentCode)) return null;
  return {
    ouvrageCode,
    component: {
      code: componentCode,
      label: getString(row, "Label", "label") || componentCode,
      description: getString(row, "Description", "description") || undefined,
      quantity: getNumber(row, "Qté", "Qte", "qty", "Qty", "quantity"),
      order: getNumber(row, "order", "Order"),
      costPrice: getNumber(row, "cost_price", "Cost_price", "costPrice"),
    },
  };
}

function normalizeOuvrage(row, productByRef, componentsByOuvrage) {
  const code = normalizeCode(getString(row, "ref", "Ref", "Ouvrage", "ouvrage"));
  if (!isTruthyCode(code)) return null;
  const product = productByRef.get(code);
  const label = getString(row, "label", "Label") || product?.label || code;
  const parsed = parseErpReference(code, label);
  const components = [...(componentsByOuvrage.get(code) ?? [])].sort(
    (a, b) => a.order - b.order || a.code.localeCompare(b.code)
  );
  const mainComponent = components[0];
  const includedTotal = components.reduce((total, component) => {
    const quantity = component.quantity > 0 ? component.quantity : component.order === 1 ? 1 : 0;
    return total + component.costPrice * quantity;
  }, 0);

  return {
    code,
    family: parsed.family,
    category: parsed.category,
    label,
    description: getString(row, "description", "Description") || product?.description,
    mainComponentCode: mainComponent?.code ?? null,
    basePrice: mainComponent?.costPrice ?? product?.costPrice ?? 0,
    defaultTotal: includedTotal,
    installation: parsed.installation ?? product?.installation,
    conception: parsed.conception ?? product?.conception,
    chargeKg: parsed.chargeKg ?? product?.chargeKg,
    reachMm: parsed.reachMm ?? product?.reachMm,
    spanMm: parsed.spanMm ?? product?.spanMm,
    heightMm: parsed.heightMm ?? product?.heightMm,
    widthMm: parsed.widthMm ?? product?.widthMm,
    components,
  };
}

function buildFamilies(products, ouvrages) {
  const families = new Map();
  function ensure(code, category) {
    const existing = families.get(code);
    if (existing) return existing;
    const created = { code, category, label: getFamilyLabel(code, category), ouvragesCount: 0, productsCount: 0, samples: [] };
    families.set(code, created);
    return created;
  }
  for (const product of products) {
    const family = ensure(product.family, product.category);
    family.productsCount += 1;
    if (family.samples.length < 5) family.samples.push(product.ref);
  }
  for (const ouvrage of ouvrages) {
    const family = ensure(ouvrage.family, ouvrage.category);
    family.ouvragesCount += 1;
    if (family.samples.length < 5 && !family.samples.includes(ouvrage.code)) family.samples.push(ouvrage.code);
  }
  return [...families.values()].sort((a, b) => a.category.localeCompare(b.category) || a.code.localeCompare(b.code));
}

function normalizeErpWorkbook(raw) {
  const products = raw.productsRows.map(normalizeProduct).filter(Boolean);
  const productByRef = new Map(products.map((product) => [product.ref, product]));
  const componentsByOuvrage = new Map();

  for (const row of raw.joinedRows) {
    const normalized = normalizeJoinedComponent(row);
    if (!normalized) continue;
    const current = componentsByOuvrage.get(normalized.ouvrageCode) ?? [];
    current.push(normalized.component);
    componentsByOuvrage.set(normalized.ouvrageCode, current);
  }

  const ouvrages = raw.ouvragesRows
    .map((row) => normalizeOuvrage(row, productByRef, componentsByOuvrage))
    .filter(Boolean)
    .sort((a, b) => a.code.localeCompare(b.code));
  const families = buildFamilies(products, ouvrages);

  return {
    generatedAt: new Date().toISOString(),
    source: raw.source,
    sheets: raw.sheets,
    stats: {
      ouvrages: ouvrages.length,
      products: products.length,
      families: families.length,
      componentsLines: [...componentsByOuvrage.values()].reduce((total, lines) => total + lines.length, 0),
    },
    families,
    ouvrages,
    products: products.sort((a, b) => a.ref.localeCompare(b.ref)),
  };
}

function resolveSourcePath() {
  const sourceArg = process.argv[2];
  if (sourceArg) return path.resolve(sourceArg);

  const candidates = [
    "export_ouvrages_2026.ods",
    "export_ouvrages_2026.xlsx",
    "export_ouvrages_2026.xls",
  ].map((file) => path.resolve(file));

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  return found ?? candidates[0];
}

async function main() {
  const sourcePath = resolveSourcePath();
  const outputJsonPath = path.resolve("data/erp/erp-snapshot.json");
  const outputTsPath = path.resolve("data/erp/erp-snapshot.ts");

  if (!fs.existsSync(sourcePath)) throw new Error(`Fichier ERP introuvable: ${sourcePath}`);

  let xlsx;
  try {
    xlsx = require("xlsx");
  } catch (error) {
    throw new Error("Dépendance manquante: installez xlsx avec `npm install xlsx` avant de lancer l'import ERP.");
  }

  const workbook = xlsx.readFile(sourcePath, { cellDates: false, raw: false });
  const sheets = {
    ouvrages: assertSheet(workbook, "ouvrages"),
    details: assertSheet(workbook, "details"),
    products: assertSheet(workbook, "products"),
    joined: assertSheet(workbook, "joined"),
  };
  const sheetToRows = (sheetName) => xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "", raw: false });
  const snapshot = normalizeErpWorkbook({
    source: path.basename(sourcePath),
    sheets,
    ouvragesRows: sheetToRows(sheets.ouvrages),
    detailsRows: sheetToRows(sheets.details),
    productsRows: sheetToRows(sheets.products),
    joinedRows: sheetToRows(sheets.joined),
  });

  const wrapper = `import type { ErpSnapshot } from "@/lib/erp/types";\nimport rawSnapshot from "./erp-snapshot.json";\n\nexport const erpSnapshot = rawSnapshot as ErpSnapshot;\n`;
  fs.mkdirSync(path.dirname(outputJsonPath), { recursive: true });
  fs.writeFileSync(outputJsonPath, JSON.stringify(snapshot, null, 2), "utf8");
  fs.writeFileSync(outputTsPath, wrapper, "utf8");

  console.log("✅ Import ERP terminé");
  console.log(`   Source: ${snapshot.source}`);
  console.log(`   Feuilles: ouvrages=${sheets.ouvrages}, details=${sheets.details}, products=${sheets.products}, joined=${sheets.joined}`);
  console.log(`   Ouvrages: ${snapshot.stats.ouvrages}`);
  console.log(`   Produits: ${snapshot.stats.products}`);
  console.log(`   Familles: ${snapshot.stats.families}`);
  console.log(`   Lignes composants: ${snapshot.stats.componentsLines}`);
}

main().catch((error) => {
  console.error("❌ Import ERP échoué");
  console.error(error.message);
  process.exit(1);
});
