import "server-only";
import prices from "@/data/stockman/prix-vente-oyste-v137.json";

const stockmanPrices: Record<string, number> = prices.prices;

export function getStockmanSellingPriceHT(reference: string): number | null {
  const ref = reference.trim().toUpperCase();
  const value = stockmanPrices[ref];
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

export function formatStockmanSellingPrice(reference: string): string {
  const price = getStockmanSellingPriceHT(reference);
  if (price === null) return "Nous consulter";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(price) + " HT";
}
