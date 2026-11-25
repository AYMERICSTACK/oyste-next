/** Pure supplier stock decision used by the real checkout guard. No DB, network or payment. */
export type StockmanCheckoutReading = {
  reference: string;
  stock: number;
  stockOnRequest?: boolean;
  readAt: string;
};

export function isStockmanReadingSufficient(
  product: StockmanCheckoutReading | null | undefined,
  reference: string,
  required: number,
  now = Date.now(),
): boolean {
  if (!Number.isSafeInteger(required) || required < 1) return false;
  if (!product || product.reference.trim().toUpperCase() !== reference.trim().toUpperCase()) return false;
  if (product.stockOnRequest !== false || !Number.isSafeInteger(product.stock) || product.stock < required) return false;
  const checkedAt = Date.parse(product.readAt);
  return Number.isFinite(checkedAt) && checkedAt <= now + 60_000 && now - checkedAt <= 120_000;
}
