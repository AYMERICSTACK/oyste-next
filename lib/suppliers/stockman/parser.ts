import type { StockmanProduct } from "./types";
import type { StockmanCommercialRowSnapshot } from "./page-structure";
import { commercialCellNumber } from "./commercial-evidence";

type ParseInput = {
  bodyText: string;
  reference: string;
  sourceUrl: string;
  pageTitle?: string | null;
  commercialRows?: StockmanCommercialRowSnapshot[];
};

/** Text mentions (including compatibility lists) are never commercial evidence. */
export function parseStockmanProduct(input: ParseInput): StockmanProduct {
  const reference = input.reference.trim().toUpperCase();
  const matches = (input.commercialRows ?? []).filter(row =>
    row.isCommercialTable && row.reference.trim().toUpperCase() === reference,
  );
  if (matches.length !== 1) {
    throw new Error(`Ligne commerciale exacte unique introuvable pour ${reference}.`);
  }
  const row = matches[0];
  if (/produit\s+arr[eê]t[eé]|discontinued/i.test(row.description ?? "")) {
    throw new Error(`Référence arrêtée chez STOCKMAN : ${reference}.`);
  }
  const stock = commercialCellNumber(row.stockText ?? "", "stock");
  const price = commercialCellNumber(row.priceText ?? "", "price");
  const weight = row.text.match(/Poids\s*:\s*(\d+(?:[.,]\d+)?)\s*kg/i);
  return {
    reference,
    designation: row.description?.trim() || reference,
    purchasePriceExVat: price ?? 0,
    priceOnRequest: price === null || price <= 0,
    // Storage schema uses an integer; this sentinel MUST travel with its flag.
    stock: stock ?? 0,
    stockOnRequest: stock === null,
    weightKg: weight ? Number(weight[1].replace(",", ".")) : null,
    sourceUrl: input.sourceUrl,
    readAt: new Date().toISOString(),
  };
}
