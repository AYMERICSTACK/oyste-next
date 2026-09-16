import type { ShippingCartResult, ShippingLineResult, ShippingProductInput } from "./types";
import { isStockmannSupplier } from "./stockmann";
import { calculateMessagerie, getMessagerieWeight } from "./messagerie";
import { calculateAffretement, calculateAffretementC0 } from "./affretement";
import { calculatePfiFreight } from "./pfi-freight";
import { calculatePftFreight } from "./pft-freight";
import { calculateWallPotenceFreight } from "./wall-potence-freight";
import { normalizePostcode } from "./zones";
import { isAdeiTripodCode, resolveAdeiTripodShipping } from "./adei-tripod-shipping";
import { calculateAdeiOfficialTransport, getAdeiTransportSource } from "./adei-official-transport";

const CONFIGURATOR_FAMILIES = /^(PFI|PFT|PMI|PMT|PMA|PMAM|PORT)/i;

export function resolveShippingLine(product: ShippingProductInput, postcode?: string): ShippingLineResult {
  const quantity = Math.max(1, product.quantity || 1);

  if (product.pfiShipping) {
    const family = product.pfiShipping.family ?? "PFI";
    const result = family === "PFT"
      ? calculatePftFreight({ ...product.pfiShipping, postcode })
      : calculatePfiFreight({ ...product.pfiShipping, postcode });
    return {
      mode: result.amountHT === null ? "quote" : "affretement",
      label: result.amountHT === null ? "Transport spécialisé · prix à confirmer" : "Transport spécialisé",
      description: `Livraison par affrètement calculée selon la configuration ${family} et la destination.`,
      amountHT: result.amountHT === null ? null : result.amountHT * quantity,
      reason: result.reason,
      coefficient: result.coefficient,
      rateCode: result.rateCode,
      bracket: result.bracket,
    };
  }

  if (product.wallPotenceShipping) {
    const result = calculateWallPotenceFreight({
      ...product.wallPotenceShipping,
      postcode,
      quantity,
    });
    return {
      mode: result.mode,
      label:
        result.amountHT === null
          ? "Transport · prix à confirmer"
          : result.mode === "messagerie"
            ? "Expédition standard"
            : "Transport spécialisé",
      description:
        result.mode === "messagerie"
          ? "Expédition calculée selon le poids de la potence et la destination."
          : "Livraison par affrètement selon la destination.",
      amountHT: result.amountHT,
      weightKg: result.weightKg,
      reason: result.reason,
      rateCode: result.rateCode,
      bracket: result.bracket,
    };
  }
  // ADEI : grille ERP officielle. Les autres fournisseurs et les calculateurs
  // spécialisés ci-dessus conservent intégralement leur comportement.
  if (/^ADEI$/i.test(String(product.supplier || "").trim()) && product.kind === "catalogue") {
    const ref = getAdeiTransportSource(product.code);
    const code = String(product.code || "").trim().toUpperCase();
    const excluded = /^(PALBAF|PALBAR|PALBAG|PADC)/.test(code);
    const isLsr = ref.lsrWeightKg !== undefined;
    const isPorti = /^PORTI/.test(code);
    const isTripod = isAdeiTripodCode(code);
    const isHook = /^CROCHET/.test(code);
    const tripod = isTripod ? resolveAdeiTripodShipping(product) : null;
    const mode = isLsr || isPorti ? "messagerie"
      : isTripod ? (tripod?.mode === "MESSAGERIE" ? "messagerie" : tripod?.mode === "AFFRETEMENT" ? "affretement" : undefined)
      : undefined;
    const coefficient = tripod?.affretementCoefficient;
    const hasAssignment = Boolean(ref.assignment);
    if (!excluded && (hasAssignment || isLsr || isPorti || isTripod || product.shippingMode === "MESSAGERIE")) {
      const result = isTripod && !tripod
        ? { mode: "quote" as const, amountHT: null, reason: "Dimensions et poids du tripode à confirmer." }
        : calculateAdeiOfficialTransport({
            code: product.code, postcode, quantity, weightKg: product.weightKg,
            mode, coefficient,
          });
      return {
        ...result,
        mode: result.amountHT === null ? "quote" : result.mode,
        label: result.amountHT === null ? "Transport · prix à confirmer" : result.mode === "messagerie" ? "Expédition standard" : "Transport spécialisé",
        description: result.mode === "messagerie" ? "Expédition calculée selon le poids et la destination." : "Livraison par transport spécialisé, calculée selon votre département.",
      };
    }
    // Une référence ADEI sans règle validée ne doit pas hériter d'une
    // ancienne grille ou d'un coefficient déduit arbitrairement du poids.
    if (excluded || isHook || /^PORT/.test(code) || /^PAL/.test(code) || product.shippingMode === "AFFRETEMENT") {
      return { mode: "quote", label: "Transport sur devis", description: "Le transport sera confirmé après étude de la commande.", amountHT: null, reason: "Règle transport ADEI à confirmer." };
    }
  }
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
    const isAdeiTripod = /^ADEI$/i.test(String(product.supplier || "").trim()) && isAdeiTripodCode(product.code);
    const result = isAdeiTripod ? calculateAffretementC0(totalWeight, postcode) : affretement;
    return {
      mode: result.amountHT === null ? "quote" : "affretement",
      label: result.amountHT === null ? "Transport spécialisé · prix à confirmer" : "Transport spécialisé",
      description: isAdeiTripod
        ? "Livraison du tripode ADEI par affrètement selon la destination · coefficient C0."
        : "Solution de transport adaptée aux caractéristiques de l’équipement.",
      ...result,
    };
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
