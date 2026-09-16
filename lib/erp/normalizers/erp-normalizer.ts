import { getFamilyLabel, parseErpReference } from "../families";
import type { ErpComponent, ErpFamily, ErpOuvrage, ErpProduct, ErpSnapshot } from "../types";

import type { ErpRawRow, ErpRawWorkbook } from "../reader";

type RawRow = ErpRawRow;

function getString(row: RawRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return "";
}

function getNumber(row: RawRow, ...keys: string[]) {
  const value = getString(row, ...keys).replace(",", ".");
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCode(value: string) {
  return value.trim();
}

function isTruthyCode(value: string) {
  return value.length > 0 && value.toLowerCase() !== "nan";
}

function getOptionalNumber(row: RawRow, ...keys: string[]) {
  const raw = getString(row, ...keys);
  if (!raw) return undefined;
  const parsed = Number.parseFloat(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function convertWeightToKg(value: number | undefined, unitPower: number | undefined) {
  if (value === undefined || value <= 0 || unitPower === undefined) return undefined;
  return value * Math.pow(10, unitPower);
}

function convertLengthToCm(value: number | undefined, unitPower: number | undefined) {
  if (value === undefined || value <= 0 || unitPower === undefined) return undefined;
  return value * Math.pow(10, unitPower + 2);
}

function normalizeProduct(row: RawRow): ErpProduct | null {
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

  return {
    ref,
    label,
    description: getString(row, "description", "Description") || undefined,
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
    weightKg: convertWeightToKg(rawWeight, rawWeightUnit),
    packageLengthCm: convertLengthToCm(rawLength, rawLengthUnit),
    packageWidthCm: convertLengthToCm(rawWidth, rawWidthUnit),
    packageHeightCm: convertLengthToCm(rawHeight, rawHeightUnit),
  };
}

function normalizeJoinedComponent(row: RawRow): { ouvrageCode: string; component: ErpComponent } | null {
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

function normalizeOuvrage(row: RawRow, productByRef: Map<string, ErpProduct>, componentsByOuvrage: Map<string, ErpComponent[]>): ErpOuvrage | null {
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

function buildFamilies(products: ErpProduct[], ouvrages: ErpOuvrage[]): ErpFamily[] {
  const families = new Map<string, ErpFamily>();

  function ensure(code: string, category: ErpFamily["category"]) {
    const existing = families.get(code);
    if (existing) return existing;

    const created: ErpFamily = {
      code,
      category,
      label: getFamilyLabel(code, category),
      ouvragesCount: 0,
      productsCount: 0,
      samples: [],
    };

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
    if (family.samples.length < 5 && !family.samples.includes(ouvrage.code)) {
      family.samples.push(ouvrage.code);
    }
  }

  return [...families.values()].sort((a, b) => {
    const categoryOrder = a.category.localeCompare(b.category);
    return categoryOrder || a.code.localeCompare(b.code);
  });
}

export function normalizeErpWorkbook(raw: ErpRawWorkbook): ErpSnapshot {
  const products = raw.productsRows
    .map(normalizeProduct)
    .filter((product): product is ErpProduct => product !== null);
  const productByRef = new Map(products.map((product) => [product.ref, product]));

  const componentsByOuvrage = new Map<string, ErpComponent[]>();

  for (const row of raw.joinedRows) {
    const normalized = normalizeJoinedComponent(row);
    if (!normalized) continue;

    const current = componentsByOuvrage.get(normalized.ouvrageCode) ?? [];
    current.push(normalized.component);
    componentsByOuvrage.set(normalized.ouvrageCode, current);
  }

  const ouvrages = raw.ouvragesRows
    .map((row) => normalizeOuvrage(row, productByRef, componentsByOuvrage))
    .filter((ouvrage): ouvrage is ErpOuvrage => ouvrage !== null)
    .sort((a, b) => a.code.localeCompare(b.code));

  return {
    generatedAt: new Date().toISOString(),
    source: raw.source,
    sheets: raw.sheets,
    stats: {
      ouvrages: ouvrages.length,
      products: products.length,
      families: buildFamilies(products, ouvrages).length,
      componentsLines: [...componentsByOuvrage.values()].reduce((total, lines) => total + lines.length, 0),
    },
    families: buildFamilies(products, ouvrages),
    ouvrages,
    products: products.sort((a, b) => a.ref.localeCompare(b.ref)),
  };
}
