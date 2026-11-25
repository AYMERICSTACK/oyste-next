import { stockmanSellingPriceHT, stockmanShippingMode, stockmanSource } from "./order-policy";

export function confirmedStockmanFreight(sourceData: unknown, storedMode: unknown) {
  const source = stockmanSource(sourceData);
  const charge = (value: unknown) => {
    if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };
  return {
    freightCostHT: charge(source.freightCostHT),
    freightChargedHT: stockmanShippingMode(sourceData, storedMode) === "INCLUDED" ? 0 : charge(source.freightChargedHT),
  };
}

type MarginStatus = "missing_data" | "negative" | "below_reference" | "meets_reference";

export function auditStockmanMargin(input: {
  purchasePriceHT: number | null;
  salePriceHT: number | null;
  freightCostHT?: number | null;
  freightChargedHT?: number | null;
}) {
  const { purchasePriceHT, salePriceHT, freightCostHT, freightChargedHT } = input;
  const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const positive = (value: number | null): value is number => value !== null && Number.isFinite(value) && value > 0;
  const knownFreight = (value?: number | null): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
  const referencePriceHT = positive(purchasePriceHT) ? stockmanSellingPriceHT(purchasePriceHT) : null;
  if (!positive(purchasePriceHT) || !positive(salePriceHT)) {
    return { referencePriceHT, grossMarginHT: null, marginRate: null, marginAfterFreightHT: null, marginRateAfterFreight: null, status: "missing_data" as MarginStatus };
  }
  const grossMarginHT = money(salePriceHT - purchasePriceHT);
  const marginRate = money(100 * (salePriceHT - purchasePriceHT) / salePriceHT);
  const net = knownFreight(freightCostHT) && knownFreight(freightChargedHT)
    ? salePriceHT + freightChargedHT - purchasePriceHT - freightCostHT : null;
  const status: MarginStatus = grossMarginHT < 0 ? "negative" : salePriceHT < (referencePriceHT ?? 0) ? "below_reference" : "meets_reference";
  return { referencePriceHT, grossMarginHT, marginRate,
    marginAfterFreightHT: net === null ? null : money(net),
    marginRateAfterFreight: net === null ? null : money(100 * net / (salePriceHT + (freightChargedHT ?? 0))), status };
}
