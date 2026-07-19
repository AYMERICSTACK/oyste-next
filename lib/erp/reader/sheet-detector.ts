import type { ErpSheetDetectionResult, ErpSheetName } from "./types";

const SHEET_ALIASES: Record<ErpSheetName, string[]> = {
  ouvrages: ["export_ouvrage", "export_ouvrages", "ouvrages"],
  details: ["export_det", "export_detail", "export_details", "details"],
  products: ["export_produits", "export_products", "produits", "products"],
  joined: ["ouvrage+det", "ouvrages+det", "ouvrage_det", "ouvrage_details"],
};

function normalizeSheetName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, "_");
}

export function detectErpSheets(sheetNames: string[]): ErpSheetDetectionResult {
  const normalizedByName = new Map(sheetNames.map((name) => [normalizeSheetName(name), name]));
  const sheets: ErpSheetDetectionResult["sheets"] = {};
  const missing: ErpSheetName[] = [];

  for (const [target, aliases] of Object.entries(SHEET_ALIASES) as [ErpSheetName, string[]][]) {
    const found = aliases.map(normalizeSheetName).map((alias) => normalizedByName.get(alias)).find(Boolean);

    if (found) {
      sheets[target] = found;
    } else {
      missing.push(target);
    }
  }

  return { sheets, missing };
}
