import type { Prisma } from "@/generated/prisma/client";

export type SupplierPricingRule = {
  marginRate: number;
  purchaseAdjustmentRate: number;
  updatedAt?: string | null;
};

export const DEFAULT_SUPPLIER_PRICING_RULE: SupplierPricingRule = {
  marginRate: 25,
  purchaseAdjustmentRate: 0,
};

export function normalizePricingRule(
  value: unknown,
): SupplierPricingRule {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_SUPPLIER_PRICING_RULE };
  }

  const source = value as Record<string, unknown>;
  const marginRate =
    typeof source.marginRate === "number" && Number.isFinite(source.marginRate)
      ? source.marginRate
      : DEFAULT_SUPPLIER_PRICING_RULE.marginRate;
  const purchaseAdjustmentRate =
    typeof source.purchaseAdjustmentRate === "number" &&
    Number.isFinite(source.purchaseAdjustmentRate)
      ? source.purchaseAdjustmentRate
      : DEFAULT_SUPPLIER_PRICING_RULE.purchaseAdjustmentRate;

  return {
    marginRate,
    purchaseAdjustmentRate,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : null,
  };
}

export function supplierPricingSettingKey(supplierId: string) {
  return `supplier-pricing:${supplierId}`;
}

export function calculateSellingPriceHT(
  purchasePriceHT: number,
  rule: SupplierPricingRule,
) {
  if (!Number.isFinite(purchasePriceHT) || purchasePriceHT <= 0) return null;
  if (
    !Number.isFinite(rule.marginRate) ||
    rule.marginRate < 0 ||
    rule.marginRate >= 100
  ) {
    return null;
  }

  const adjustedPurchase =
    purchasePriceHT * (1 + rule.purchaseAdjustmentRate / 100);
  const sellingPrice = adjustedPurchase / (1 - rule.marginRate / 100);

  return Math.round((sellingPrice + Number.EPSILON) * 100) / 100;
}

export function extractPurchasePriceFromSourceData(
  sourceData: Prisma.JsonValue | null,
) {
  if (!sourceData || typeof sourceData !== "object" || Array.isArray(sourceData)) {
    return null;
  }

  const root = sourceData as Record<string, unknown>;
  const stockman =
    root.stockman && typeof root.stockman === "object" && !Array.isArray(root.stockman)
      ? (root.stockman as Record<string, unknown>)
      : null;

  const candidates = [
    stockman?.purchasePriceExVat,
    root.purchasePriceExVat,
    root.purchasePriceHT,
    root.purchasePrice,
    root.costPrice,
  ];

  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return null;
}
