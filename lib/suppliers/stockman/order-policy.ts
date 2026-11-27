/** Brief + exact rows marked PRODUIT ARRÊTÉ on STOCKMAN LP page, checked 2026-11-05.
 * No family/prefix blocking. See audit evidence; revalidate before release. */
export function isBlockedStockmanReference(reference: string): boolean {
  return ["LP180", "LP280", "LP150", "LP250", "LP-BC05M2", "LP-FCA04"].includes(reference.trim().toUpperCase());
}

export function stockmanSellingPriceHT(purchase: number): number | null {
  if (!Number.isFinite(purchase) || purchase <= 0) return null;
  return Math.round((purchase / 0.8 + Number.EPSILON) * 100) / 100;
}

export function stockmanSource(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = (value as Record<string, unknown>).stockman;
  return source && typeof source === "object" && !Array.isArray(source)
    ? source as Record<string, unknown> : {};
}

export function stockmanStockUnknown(value: unknown): boolean {
  const source = stockmanSource(value);
  return source.stockOnRequest === true || source.stock === null || source.stockLabel === "Nous consulter";
}
export function stockmanPriceUnknown(value: unknown): boolean {
  const source = stockmanSource(value);
  return source.priceOnRequest === true || source.purchasePriceUnavailable === true;
}

/** Legacy INCLUDED alone is not proof of actual freight coverage. */
export function stockmanFreightValidated(sourceData: unknown, shippingMode: unknown): boolean {
  return shippingMode === "INCLUDED" && stockmanSource(sourceData).freightIncludedValidated === true;
}

export function hasStockmanPriceHold(...references: Array<string | null | undefined>): boolean {
  return references.some(reference => ["CT420", "CT420S", "E250"].includes(reference?.trim().toUpperCase() ?? ""));
}

export function isCollectiveStockmanImport(value: unknown): boolean {
  if (!value || typeof value !== "object" || !("v297" in value)) return false;
  const audit = value.v297;
  return Boolean(audit && typeof audit === "object" && "runId" in audit && typeof audit.runId === "string");
}

export function collectiveStockmanStockOnRequest(sourceData: unknown, now = Date.now()): boolean {
  const source = stockmanSource(sourceData);
  const readAt = typeof source.stockReadAt === "string" ? Date.parse(source.stockReadAt) : NaN;
  return stockmanStockUnknown(sourceData) || typeof source.stock !== "number" || !Number.isSafeInteger(source.stock) ||
    source.stock < 0 || !Number.isFinite(readAt) || readAt > now || now - readAt >= 86_400_000;
}

export function collectiveStockmanRequiresQuote(sourceData: unknown, mode: unknown, quantity = 1): boolean {
  const stock = stockmanSource(sourceData).stock;
  return collectiveStockmanStockOnRequest(sourceData) || typeof stock !== "number" || stock < quantity ||
    stockmanShippingMode(sourceData, mode) === "QUOTE";
}

export function stockmanShippingMode(sourceData: unknown, mode: unknown): "INCLUDED" | "MESSAGERIE" | "AFFRETEMENT" | "QUOTE" {
  if (mode === "MESSAGERIE" || mode === "AFFRETEMENT") return mode;
  return stockmanFreightValidated(sourceData, mode) ? "INCLUDED" : "QUOTE";
}
