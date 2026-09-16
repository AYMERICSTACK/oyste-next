import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { CheckoutItemInput } from "@/lib/orders/secure-checkout-items";
import { getRequestedKitoLiftM, getKitoChainWeightRule } from "@/lib/shipping/kito-chain-weight";
import { getKitoChainPricingRule } from "@/lib/pricing/kito-chain-price";

import { kitoSupplierFreightCost } from "@/lib/pricing/kito-freight-rules";

const KITO_MARGIN = 0.25;
const DIVISOR = 1 - KITO_MARGIN;
const SMALL_PARCEL_MAX_KG = 29;

function round2(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function sourceObject(sourceData: unknown) {
  return sourceData && typeof sourceData === "object" && !Array.isArray(sourceData)
    ? sourceData as Record<string, unknown>
    : {};
}
function positiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}
export type KitoOrderAdjustment = {
  purchaseTotalHT: number;
  supplierFreightCostHT: number;
  embeddedProvisionSellingHT: number;
  actualFreightSellingHT: number;
  discountHT: number;
  discountPercent: number;
  transitUnits: number;
  directUnits: number;
  discountReason: "TRANSPORT" | "GROUPING";
};

export async function calculateKitoOrderAdjustment(items: CheckoutItemInput[]): Promise<KitoOrderAdjustment | null> {
  const kitoItems = items.filter((item) => item.kind === "catalogue" && /^KITO$/i.test(String(item.supplier || "").trim()) && item.code);
  if (!kitoItems.length) return null;

  let purchaseTotalHT = 0;
  let embeddedProvisionSellingHT = 0;
  let kitoDisplayedSubtotalHT = 0;
  let transitUnits = 0;
  let directUnits = 0;
  let directProvisionRefundSellingHT = 0;

  for (const item of kitoItems) {
    const variant = await prisma.productVariant.findFirst({
      where: { code: { equals: item.code!, mode: "insensitive" } },
      select: { sourceData: true },
    });
    const source = sourceObject(variant?.sourceData);
    const basePurchase = positiveNumber(source.kitoPurchasePriceHT);
    if (basePurchase == null) throw new Error(`PA KITO indisponible pour ${item.code}.`);

    const embeddedFreightCost = positiveNumber(source.kitoSupplierFreightProvisionCostHT) || 0;
    const finalWeightKg = positiveNumber(item.weightKg);
    if (finalWeightKg == null) {
      // Les 16 références sans poids restent volontairement hors automatisme.
      // Leur transport doit rester à confirmer plutôt que d'inventer un circuit.
      continue;
    }

    let extraChainPurchase = 0;
    const requestedLift = getRequestedKitoLiftM(item.technicalLines);
    const weightRule = getKitoChainWeightRule(item.code);
    if (requestedLift != null && weightRule && requestedLift > weightRule.baseLiftM) {
      const chainRule = await getKitoChainPricingRule(item.code);
      if (!chainRule) throw new Error(`PA chaîne KITO indisponible pour ${item.code}.`);
      extraChainPurchase = (requestedLift - weightRule.baseLiftM) * chainRule.purchasePricePerMeterHT;
    }

    const quantity = Math.max(1, item.quantity || 1);
    kitoDisplayedSubtotalHT += item.unitPriceHT * quantity;

    // La provision de port n'existe que sur les références dont le prix catalogue
    // a été construit avec cette provision. Si la chaîne fait passer le poids final
    // au-dessus de 29 kg, cette provision est intégralement restituée au panier.
    embeddedProvisionSellingHT += (embeddedFreightCost / DIVISOR) * quantity;

    if (finalWeightKg <= SMALL_PARCEL_MAX_KG) {
      transitUnits += quantity;
      purchaseTotalHT += (basePurchase + extraChainPurchase) * quantity;
    } else {
      directUnits += quantity;
      if (embeddedFreightCost > 0) {
        directProvisionRefundSellingHT += (embeddedFreightCost / DIVISOR) * quantity;
      }
    }
  }

  const supplierFreightCostHT = kitoSupplierFreightCost(purchaseTotalHT);
  const actualFreightSellingHT = supplierFreightCostHT / DIVISOR;
  const discountHT = Math.max(0, round2(embeddedProvisionSellingHT - actualFreightSellingHT));
  const discountPercent = kitoDisplayedSubtotalHT > 0 ? round2((discountHT / kitoDisplayedSubtotalHT) * 100) : 0;

  return {
    purchaseTotalHT: round2(purchaseTotalHT),
    supplierFreightCostHT: round2(supplierFreightCostHT),
    embeddedProvisionSellingHT: round2(embeddedProvisionSellingHT),
    actualFreightSellingHT: round2(actualFreightSellingHT),
    discountHT,
    discountPercent,
    transitUnits,
    directUnits,
    discountReason: (transitUnits + directUnits) <= 1 ? "TRANSPORT" : "GROUPING",
  };
}
