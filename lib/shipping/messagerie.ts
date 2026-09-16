import { MESSAGERIE_BANDS, MESSAGERIE_PRICES, MESSAGERIE_WEIGHTS_KG } from "./shipping-data";
import { getDepartmentCode } from "./zones";

export function normalizeReference(code?: string) {
  return (code || "").trim().toUpperCase().replace(/\s+/g, "");
}
export function getMessagerieWeight(code?: string) {
  return MESSAGERIE_WEIGHTS_KG[normalizeReference(code)] ?? null;
}
export function calculateMessagerie(code: string | undefined, postcode: string | undefined, quantity = 1, productWeightKg?: number) {
  const unitWeight = productWeightKg && productWeightKg > 0 ? productWeightKg : getMessagerieWeight(code);
  const department = getDepartmentCode(postcode);
  if (unitWeight === null) return null;
  const totalWeight = unitWeight * Math.max(1, quantity);
  if (!department) return { amountHT: null, weightKg: totalWeight, reason: "Code postal requis" };
  const prices = MESSAGERIE_PRICES[department];
  if (!prices) return { amountHT: null, weightKg: totalWeight, reason: "Destination hors grille messagerie" };
  const index = MESSAGERIE_BANDS.findIndex((band) => totalWeight >= band.min && totalWeight <= band.max);
  if (index >= 0) return { amountHT: prices[index] ?? null, weightKg: totalWeight, reason: "Tarif calculé selon département et tranche de poids" };

  // La grille fournisseur prévoit la messagerie jusqu’à 250 kg.
  // Au-delà de 200 kg, le tarif est prolongé au prorata du tarif 200 kg.
  if (totalWeight > 200 && totalWeight <= 250) {
    const priceAt200Kg = prices[prices.length - 1];
    return {
      amountHT: priceAt200Kg === undefined ? null : Number((priceAt200Kg * totalWeight / 200).toFixed(2)),
      weightKg: totalWeight,
      reason: "Tarif messagerie calculé au poids jusqu’à 250 kg",
    };
  }

  return { amountHT: null, weightKg: totalWeight, reason: "Poids hors grille messagerie (31 à 250 kg)" };
}
