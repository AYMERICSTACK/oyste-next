export type AdeiCommercialRule = {
  key: "PORTIQUE" | "PALONNIER" | "CROCHET" | "CHARIOT_PORTE_PALAN" | "LIGNE_ALIM" | "TRIPODE";
  marginRate: number;
};

function normalize(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

export function getAdeiCommercialRule(input: {
  code?: string | null;
  name?: string | null;
  categoryPath?: string | null;
}): AdeiCommercialRule | null {
  const code = normalize(input.code).replace(/\s+/g, "");
  const haystack = normalize(`${input.name || ""} ${input.categoryPath || ""}`);

  if (code === "IS2") return { key: "CROCHET", marginRate: 25 };
  if (code.startsWith("IS") || haystack.includes("CROCHET")) return { key: "CROCHET", marginRate: 23 };
  if (haystack.includes("PORTIQUE")) return { key: "PORTIQUE", marginRate: 23 };
  if (haystack.includes("PALONNIER")) return { key: "PALONNIER", marginRate: 23 };
  if (haystack.includes("CHARIOT PORTE PALAN")) return { key: "CHARIOT_PORTE_PALAN", marginRate: 25 };
  if (code.startsWith("LSR") || haystack.includes("LIGNE D'ALIMENTATION") || haystack.includes("LIGNE ALIMENTATION")) {
    return { key: "LIGNE_ALIM", marginRate: 30 };
  }
  if (code.startsWith("TRA") || haystack.includes("TRIPODE")) return { key: "TRIPODE", marginRate: 30 };

  return null;
}

export function calculateAdeiSellingPriceHT(purchasePriceHT: number, marginRate: number) {
  if (!Number.isFinite(purchasePriceHT) || purchasePriceHT <= 0) return null;
  if (!Number.isFinite(marginRate) || marginRate < 0 || marginRate >= 100) return null;
  return Math.round((purchasePriceHT / (1 - marginRate / 100) + Number.EPSILON) * 100) / 100;
}
