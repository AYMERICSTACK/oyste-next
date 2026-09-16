export const KITO_MARGIN = 0.25;
export const KITO_DIVISOR = 1 - KITO_MARGIN;
export const KITO_SMALL_PARCEL_MAX_KG = 29;

export function kitoSupplierFreightCost(purchaseTotal: number): number {
  if (!Number.isFinite(purchaseTotal) || purchaseTotal <= 0) return 0;
  if (purchaseTotal < 500) return 35;
  if (purchaseTotal <= 1500) return purchaseTotal * 0.035;
  return 0;
}
