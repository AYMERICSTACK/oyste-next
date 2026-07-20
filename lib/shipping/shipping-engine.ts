import type { ShippingCartResult, ShippingLineResult, ShippingProductInput } from "./types";
import { isStockmannSupplier } from "./stockmann";
import { calculateMessagerie, getMessagerieWeight } from "./messagerie";
import { calculateAffretement } from "./affretement";
import { normalizePostcode } from "./zones";

const CONFIGURATOR_FAMILIES = /^(PFI|PFT|PMI|PMT|PMA|PMAM|PORT)/i;

export function resolveShippingLine(product: ShippingProductInput, postcode?: string): ShippingLineResult {
  const quantity = Math.max(1, product.quantity || 1);
  const persistedMode = product.shippingMode;

  if (persistedMode === "INCLUDED" || (!persistedMode && isStockmannSupplier(product.supplier))) {
    return { mode: "included", label: "Livraison incluse", description: "Transport déjà compris dans le prix du produit.", amountHT: 0, reason: "Livraison comprise pour cette référence" };
  }

  if (persistedMode === "MESSAGERIE") {
    const result = calculateMessagerie(product.code, postcode, quantity, product.weightKg);
    const unitWeight = product.weightKg || getMessagerieWeight(product.code);
    return {
      mode: result?.amountHT === null ? "quote" : "messagerie",
      label: result?.amountHT === null ? "Expédition standard · prix à confirmer" : "Expédition standard",
      description: unitWeight ? `Expédition calculée selon le poids du produit et la destination.` : "Les caractéristiques d’expédition doivent être confirmées.",
      amountHT: result?.amountHT ?? null,
      weightKg: result?.weightKg,
      reason: result?.amountHT === null ? "Le montant sera précisé dans la confirmation de commande." : "Tarif calculé selon la destination.",
    };
  }

  const totalWeight = product.weightKg ? product.weightKg * quantity : undefined;
  const affretement = calculateAffretement(totalWeight, postcode);

  if (persistedMode === "AFFRETEMENT") {
    return { mode: affretement.amountHT === null ? "quote" : "affretement", label: affretement.amountHT === null ? "Transport spécialisé · prix à confirmer" : "Transport spécialisé", description: "Solution de transport adaptée aux caractéristiques de l’équipement.", ...affretement };
  }

  if (persistedMode === "QUOTE") {
    return { mode: "quote", label: "Transport sur devis", description: "Le transport sera confirmé après étude de la commande.", amountHT: null, weightKg: totalWeight, reason: "Le montant sera précisé dans la confirmation de commande." };
  }

  // Compatibilité avec les anciennes données tant que la reprise BDD n'a pas été exécutée.
  const officialWeight = getMessagerieWeight(product.code);
  if (officialWeight !== null) {
    const result = calculateMessagerie(product.code, postcode, quantity, officialWeight);
    return { mode: result?.amountHT === null ? "quote" : "messagerie", label: result?.amountHT === null ? "Expédition standard · prix à confirmer" : "Expédition standard", description: `${officialWeight} kg par unité · expédition selon la grille officielle.`, amountHT: result?.amountHT ?? null, weightKg: result?.weightKg, reason: result?.reason || "Référence présente dans la liste messagerie" };
  }

  const configured = product.kind === "configured" || CONFIGURATOR_FAMILIES.test(product.family || "") || CONFIGURATOR_FAMILIES.test(product.code || "");
  if (configured) return { mode: affretement.amountHT === null ? "quote" : "affretement", label: affretement.amountHT === null ? "Transport spécialisé · prix à confirmer" : "Transport spécialisé", description: "Solution de transport adaptée à cet équipement configuré ou fabriqué sur mesure.", ...affretement };

  return { mode: "quote", label: "Transport sur devis", description: "Le transport sera confirmé après étude de la commande.", amountHT: null, weightKg: totalWeight, reason: "Le montant sera précisé dans la confirmation de commande." };
}

export function calculateCartShipping(products: ShippingProductInput[], postcode?: string): ShippingCartResult {
  const lines = products.map((product) => resolveShippingLine(product, postcode));
  const hasQuote = lines.some((line) => line.amountHT === null);
  const confirmedAmountHT = lines.reduce((sum, line) => sum + (line.amountHT || 0), 0);
  const modeCounts = lines.reduce<Record<ShippingLineResult["mode"], number>>(
    (counts, line) => ({ ...counts, [line.mode]: counts[line.mode] + 1 }),
    { included: 0, messagerie: 0, affretement: 0, quote: 0 },
  );

  return {
    lines,
    amountHT: hasQuote ? null : confirmedAmountHT,
    confirmedAmountHT,
    hasQuote,
    postcodeValid: /^\d{5}$/.test(normalizePostcode(postcode)),
    modeCounts,
  };
}
