export type ShippingMode = "included" | "messagerie" | "affretement" | "quote";
export type ProductShippingMode = "INCLUDED" | "MESSAGERIE" | "AFFRETEMENT" | "QUOTE";

export type ShippingProductInput = {
  kind: "catalogue" | "configured";
  code?: string;
  supplier?: string;
  family?: string;
  weightKg?: number;
  shippingMode?: ProductShippingMode;
  quantity?: number;
};

export type ShippingLineResult = {
  mode: ShippingMode;
  label: string;
  description: string;
  amountHT: number | null;
  weightKg?: number;
  zone?: number;
  coefficient?: number;
  reason: string;
};

export type ShippingCartResult = {
  lines: ShippingLineResult[];
  amountHT: number | null;
  confirmedAmountHT: number;
  hasQuote: boolean;
  postcodeValid: boolean;
  modeCounts: Record<ShippingMode, number>;
};
