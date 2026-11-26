import type { StockmanProduct } from "./types";

export function stockmanQaScenario(request: Request) {
  if (process.env.VERCEL_ENV !== "preview"
    || process.env.VERCEL_GIT_COMMIT_REF !== "recette-stockman-isolee"
    || process.env.OYSTE_STOCKMAN_TEST !== "true") return null;
  const scenario = new URL(request.url).searchParams.get("stockman-qa");
  return scenario === "ready" || scenario === "missing" || scenario === "expired" || scenario === "stale" ? scenario : null;
}

// Values observed in the 26 November local SC102N capture. No session is used.
export const capturedStockmanSc102n: StockmanProduct = {
  reference: "SC102N",
  designation: "Rouleur avec galets pivotants 1000 kg",
  purchasePriceExVat: 151,
  stock: 23,
  weightKg: 13,
  sourceUrl: "https://www.stockman.fr/fr/coins-roulants-et-rouleurs--3/rouleurs-avec-galets--85/--1/rouleur-avec-galets-pivotants-1000-kg--SC%20N.aspx?langue=FR&src=int",
  readAt: "2026-11-26T07:55:00.000Z",
};
