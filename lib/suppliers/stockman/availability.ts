import { isBlockedStockmanReference, stockmanSource } from "./order-policy";

/** Conservative display policy; not a reservation or an immediate-delivery promise. */
export const STOCKMAN_STOCK_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export type StockmanAvailability = {
  stock: number | null;
  checkedAt: string | null;
  expiresAt: string | null;
  status: "known" | "unknown" | "stale" | "conflict" | "blocked";
};
export type StockmanStockObservation = { reference: string; stock: unknown; checkedAt: unknown };
export const normalizeStockmanReference = (value: string) => value.trim().toUpperCase();
export function unknownStockmanAvailability(status: StockmanAvailability["status"] = "unknown"): StockmanAvailability {
  return { stock: null, checkedAt: null, expiresAt: null, status };
}
function timestamp(value: unknown): number | null {
  const time = value instanceof Date ? value.getTime() : typeof value === "string" && value.trim() ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : null;
}
function quantity(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
/** Never borrow the aggregate Product.stock or a general sync date. */
export function stockmanSourceObservation(reference: string, sourceData: unknown): StockmanStockObservation {
  const source = stockmanSource(sourceData);
  const exact = typeof source.reference === "string" && normalizeStockmanReference(source.reference) === normalizeStockmanReference(reference);
  // Legacy imports have sourceReadAt. Once a sync has happened its generic readAt
  // cannot prove when stock was last read; wait for a stock-specific refresh.
  const checkedAt = source.stockReadAt ?? (source.readAt === undefined ? source.sourceReadAt : null);
  return { reference, checkedAt: exact ? checkedAt : null,
    stock: exact && source.stockOnRequest !== true && source.stockLabel !== "Nous consulter" ? source.stock : null };
}
export function resolveStockmanAvailability(reference: string, observations: StockmanStockObservation[], now = Date.now()): StockmanAvailability {
  if (isBlockedStockmanReference(reference)) return unknownStockmanAvailability("blocked");
  const exact = observations.filter(row => normalizeStockmanReference(row.reference) === normalizeStockmanReference(reference));
  const dated = exact.flatMap(row => { const at = timestamp(row.checkedAt); return at === null ? [] : [{ at, stock: quantity(row.stock) }]; });
  // A future timestamp is invalid; do not silently resurrect an older positive stock.
  if (dated.some(row => row.at > now)) return unknownStockmanAvailability();
  if (!dated.length) return unknownStockmanAvailability();
  const latest = Math.max(...dated.map(row => row.at));
  const newest = dated.filter(row => row.at === latest);
  const checkedAt = new Date(latest).toISOString();
  const expiresAt = new Date(latest + STOCKMAN_STOCK_MAX_AGE_MS).toISOString();
  if (now - latest >= STOCKMAN_STOCK_MAX_AGE_MS) return { stock: null, checkedAt, expiresAt, status: "stale" };
  const values = new Set(newest.map(row => row.stock));
  if (values.size > 1) return { stock: null, checkedAt, expiresAt, status: "conflict" };
  const stock = newest[0].stock;
  return { stock, checkedAt, expiresAt, status: stock === null ? "unknown" : "known" };
}
/** Re-evaluate the public snapshot, including when a tab stays open past expiry. */
export function currentStockmanAvailability(value: StockmanAvailability | undefined, now = Date.now()): StockmanAvailability {
  if (!value || value.status !== "known") return value ?? unknownStockmanAvailability();
  return resolveStockmanAvailability("", [{ reference: "", stock: value.stock, checkedAt: value.checkedAt }], now);
}
export function stockmanAvailabilityLabel(value: StockmanAvailability): string {
  if (value.status === "stale") return "Stock fournisseur à actualiser — Nous consulter";
  if (value.status !== "known" || value.stock === null) return "Disponibilité fournisseur inconnue — Nous consulter";
  return value.stock === 0 ? "Rupture fournisseur — Nous consulter" : `${value.stock} en stock fournisseur`;
}
