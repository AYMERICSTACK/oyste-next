export const POTENCE_MARGIN_RATE = 0.23;
export const HOIST_MARGIN_RATE = 0.25;

export function roundPrice(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateSellingPriceWithMargin(costPrice: number, marginRate: number) {
  if (!Number.isFinite(costPrice) || costPrice <= 0) return 0;
  if (!Number.isFinite(marginRate) || marginRate < 0 || marginRate >= 1) return 0;
  return roundPrice(costPrice / (1 - marginRate));
}

// Configurateur potences : structure, composants et options = 23 % de marge sur PV.
export function calculateSellingPrice(costPrice: number) {
  return calculateSellingPriceWithMargin(costPrice, POTENCE_MARGIN_RATE);
}

// Palans manuels et électriques (KITO / YALE) = 25 % de marge sur PV.
export function calculateHoistSellingPrice(costPrice: number) {
  return calculateSellingPriceWithMargin(costPrice, HOIST_MARGIN_RATE);
}

export function formatPrice(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}
