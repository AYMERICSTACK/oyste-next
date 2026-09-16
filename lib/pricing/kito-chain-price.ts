import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { CartTechnicalLine } from "@/lib/cart/types";
import { getKitoChainWeightRule, getRequestedKitoLiftM } from "@/lib/shipping/kito-chain-weight";
import { getKitoChainPriceComponentRef } from "@/lib/pricing/kito-chain-price-rules";

const KITO_CHAIN_MARGIN = 0.25;
const SELLING_DIVISOR = 1 - KITO_CHAIN_MARGIN;

export type KitoChainPricingRule = {
  baseLiftM: number;
  componentRef: string;
  purchasePricePerMeterHT: number;
  sellingPricePerMeterHT: number;
  margin: 0.25;
  source: "ERP";
};

export async function getKitoChainPricingRule(code?: string): Promise<KitoChainPricingRule | null> {
  const weightRule = getKitoChainWeightRule(code);
  const componentRef = getKitoChainPriceComponentRef(code);
  if (!weightRule || !componentRef) return null;

  const erpComponent = await prisma.erpProductRecord.findFirst({
    where: {
      ref: { equals: componentRef, mode: "insensitive" },
      isActive: true,
    },
    select: { ref: true, costPrice: true },
  });

  if (!erpComponent) return null;
  const purchasePricePerMeterHT = Number(erpComponent.costPrice);
  if (!Number.isFinite(purchasePricePerMeterHT) || purchasePricePerMeterHT <= 0) return null;

  return {
    baseLiftM: weightRule.baseLiftM,
    componentRef: erpComponent.ref,
    purchasePricePerMeterHT,
    sellingPricePerMeterHT: Math.round((purchasePricePerMeterHT / SELLING_DIVISOR) * 100) / 100,
    margin: KITO_CHAIN_MARGIN,
    source: "ERP",
  };
}

export async function calculateKitoDynamicPriceHT(input: {
  supplier?: string;
  code?: string;
  basePriceHT: number;
  technicalLines?: CartTechnicalLine[];
}) {
  const basePriceHT = Number(input.basePriceHT);
  if (!/^KITO$/i.test(String(input.supplier || "").trim()) || !Number.isFinite(basePriceHT) || basePriceHT <= 0) {
    return basePriceHT;
  }

  const requestedLiftM = getRequestedKitoLiftM(input.technicalLines);
  if (requestedLiftM === null) return basePriceHT;

  const weightRule = getKitoChainWeightRule(input.code);
  if (!weightRule || requestedLiftM <= weightRule.baseLiftM) return basePriceHT;

  const rule = await getKitoChainPricingRule(input.code);
  if (!rule) {
    throw new Error(`Tarif KITO du mètre de chaîne supplémentaire indisponible pour ${input.code || "cette référence"}.`);
  }

  const extraLiftM = requestedLiftM - rule.baseLiftM;
  const total = basePriceHT + extraLiftM * rule.sellingPricePerMeterHT;
  return Math.round(total * 100) / 100;
}
