export const CONFIGURATOR_MARGIN_RATE = 0.25;

export function roundPrice(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateSellingPrice(costPrice: number) {
  if (!Number.isFinite(costPrice) || costPrice <= 0) return 0;
  return roundPrice(costPrice / (1 - CONFIGURATOR_MARGIN_RATE));
}

export function formatPrice(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}
