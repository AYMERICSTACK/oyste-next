import { auditStockmanMargin, confirmedStockmanFreight } from "./margin-audit";
import { isBlockedStockmanReference, stockmanSource } from "./order-policy";
import type { StockmanDiscoveredReference } from "./catalog-scanner";

export type StockmanSyncCandidate = Pick<StockmanDiscoveredReference, "reference" | "sourceUrl" | "readAt" | "relationType" | "classificationConfidence" | "classificationEvidence" | "commercialText" | "supplierData">;

const refPattern = /^[A-Z0-9][A-Z0-9./_-]{1,30}$/;
const hour = 60 * 60 * 1000;

function timestamp(value: unknown) {
  const parsed = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : -Infinity;
}

function stockmanProductUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      && /^(www\.)?stockman\.fr$/.test(url.hostname) && /\.aspx$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function sameValue<T>(values: T[]) {
  return values.length > 0 && new Set(values.map(value => JSON.stringify(value))).size === 1 ? values[0] : undefined;
}

export function planStockmanCommercialUpdate(input: {
  reference: string;
  observations: StockmanSyncCandidate[];
  sourceData: unknown;
  shippingMode: unknown;
  salePriceHT: number | null;
  now: Date;
}) {
  const { reference, observations, now } = input;
  const key = reference.trim().toUpperCase();
  const current = stockmanSource(input.sourceData);
  const stopped = isBlockedStockmanReference(key) || observations.some(row => /\b(?:produit\s+arr[êe]t[ée]|discontinued)(?![\p{L}\p{N}])/iu.test(row.commercialText ?? ""));
  const facts = observations.filter(row => {
    const at = timestamp(row.readAt);
    return row.reference === key && stockmanProductUrl(row.sourceUrl)
      && (row.relationType === "PRIMARY" || row.relationType === "PRIMARY_VARIANT")
      && row.classificationConfidence !== "UNKNOWN" && Array.isArray(row.classificationEvidence) && row.classificationEvidence.includes("commercial-table")
      && at >= now.getTime() - 24 * hour && at <= now.getTime() + 60_000;
  });
  const prior = typeof current.purchasePriceExVat === "number" && current.purchasePriceExVat > 0 ? current.purchasePriceExVat : null;
  const anomalies: string[] = [];
  const fields: Record<string, string | number | boolean | null> = {};
  let stock: number | undefined;
  let observedPurchase: number | null | undefined;
  const latest = (rows: StockmanSyncCandidate[]) => new Date(Math.max(...rows.map(row => timestamp(row.readAt)))).toISOString();
  if (!refPattern.test(key) || stopped || !facts.length) {
    anomalies.push(stopped ? "REFERENCE_ARRETEE" : "LECTURE_NON_PROUVEE_OU_PERIMEE");
  } else {
    const lastPriceAt = timestamp(current.purchaseReadAt ?? current.readAt);
    const priceFacts = facts.filter(row => timestamp(row.readAt) > lastPriceAt);
    const priced = priceFacts.filter(row => row.supplierData?.priceState === "NUMERIC");
    const quoted = priceFacts.filter(row => row.supplierData?.priceState === "ON_REQUEST");
    const certified = priced.filter(row => row.supplierData?.purchasePriceUnit === "UNIT_HT");
    const price = sameValue(certified.map(row => row.supplierData?.purchasePriceExVat));
    if (priceFacts.length) {
      if (quoted.length && !priced.length) {
        observedPurchase = null;
        Object.assign(fields, { purchaseReadAt: latest(quoted), priceOnRequest: true, purchasePriceUnavailable: true });
        anomalies.push("ACHAT_SUR_DEMANDE");
      } else if (typeof price === "number" && price > 0 && price < 100_000_000 && !quoted.length && certified.length === priced.length) {
        observedPurchase = price;
        if (prior !== null && (price > 2 * prior || price < prior / 2)) {
          anomalies.push("ECART_ACHAT_A_VERIFIER");
        } else {
          Object.assign(fields, { purchaseReadAt: latest(certified), purchasePriceExVat: price, priceOnRequest: false, purchasePriceUnavailable: false });
        }
      } else {
        anomalies.push(certified.length > 1 && price === undefined ? "ACHATS_CONTRADICTOIRES" : "ACHAT_OU_UNITE_NON_PROUVES");
      }
    }
    const recentStock = facts.filter(row => timestamp(row.readAt) > timestamp(current.stockReadAt ?? current.readAt));
    const stockFacts = recentStock.flatMap(row => {
      const data = row.supplierData;
      if (data?.stockState === "NUMERIC" && typeof data.stock === "number" && Number.isSafeInteger(data.stock) && data.stock >= 0 && data.stock <= 2_147_483_647) {
        return [{ row, stock: { state: "NUMERIC", value: data.stock } }];
      }
      return data?.stockState === "ON_REQUEST" || data?.stockState === "RESTOCK" ? [{ row, stock: { state: data.stockState, value: null as number | null } }] : [];
    });
    const inventory = sameValue(stockFacts.map(item => item.stock));
    if (recentStock.length) {
      if (inventory) {
        const availabilityLabel = inventory.state === "RESTOCK"
          ? sameValue(stockFacts.flatMap(({ row }) => row.supplierData?.stockAvailabilityText ? [row.supplierData.stockAvailabilityText] : [])) || "Réapprovisionnement"
          : inventory.value === null ? "Nous consulter" : String(inventory.value);
        if (inventory.value !== null) stock = inventory.value;
        Object.assign(fields, { stockReadAt: latest(stockFacts.map(item => item.row)), stock: inventory.value,
          stockOnRequest: inventory.value === null, stockLabel: availabilityLabel });
      } else {
        anomalies.push(stockFacts.length ? "STOCKS_CONTRADICTOIRES" : "STOCK_NON_PROUVE");
      }
    }
  }
  const purchase = observedPurchase === undefined
    ? current.purchasePriceUnavailable === true || current.priceOnRequest === true ? null : prior
    : observedPurchase;
  const margin = auditStockmanMargin({ purchasePriceHT: purchase, salePriceHT: input.salePriceHT, ...confirmedStockmanFreight(input.sourceData, input.shippingMode) });
  if (margin.status === "negative" || (margin.marginAfterFreightHT !== null && margin.marginAfterFreightHT < 0)) anomalies.push("MARGE_NEGATIVE");
  if (margin.status === "below_reference") anomalies.push("MARGE_SOUS_REPERE");
  if (input.salePriceHT === null) anomalies.push("PRIX_VENTE_ABSENT");
  return { fields, stock, anomalies, margin };
}
