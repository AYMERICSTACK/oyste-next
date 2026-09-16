export type SupplierLeadTimeInfo = {
  label: string;
  note: string;
  source: "STOCKMAN" | "KITO" | "PRODUCT" | "CONFIRMATION";
  url?: string;
};

function normalize(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function getSupplierLeadTimeInfo(input: {
  supplier?: string | null;
  stock?: number | null;
  configuredDelay?: string | null;
  isConfiguratorProduct?: boolean;
}): SupplierLeadTimeInfo {
  const supplier = normalize(input.supplier);

  if (supplier.includes("stockman")) {
    if (typeof input.stock === "number" && input.stock > 0) {
      return {
        label: "Départ usine sous 48 h",
        note: "Attention : délai de départ usine indicatif, hors délai de transport et de livraison.",
        source: "STOCKMAN",
      };
    }
    return {
      label: "Délai à confirmer",
      note: "Le délai définitif sera validé après confirmation du fournisseur.",
      source: "STOCKMAN",
    };
  }

  if (supplier.includes("kito")) {
    return {
      label: "Délai estimatif : 2 à 4 semaines",
      note: "Délai estimatif fournisseur. Le délai définitif sera validé après confirmation du fournisseur.",
      source: "KITO",
    };
  }

  // Les délais synchronisés sont stockés directement sur la fiche/variante.
  // Aucune source fournisseur externe n'est exposée au client.
  if (input.configuredDelay?.trim()) {
    return {
      label: input.configuredDelay.trim(),
      note: "Délai indicatif. Le délai définitif est confirmé après validation de la commande.",
      source: "PRODUCT",
    };
  }

  if (input.isConfiguratorProduct) {
    return {
      label: "Délai indicatif selon configuration",
      note: "Le délai définitif est confirmé après validation de la commande.",
      source: "CONFIRMATION",
    };
  }

  return {
    label: "Délai confirmé à la commande",
    note: "Le délai définitif est communiqué après confirmation du fournisseur.",
    source: "CONFIRMATION",
  };
}
