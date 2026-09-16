export type ShippingMode = "included" | "messagerie" | "affretement" | "quote";
export type ProductShippingMode = "INCLUDED" | "MESSAGERIE" | "AFFRETEMENT" | "QUOTE";

export type PotenceShippingInput = { family?: "PFI" | "PFT"; capacityKg: number; spanM: number; hsfM: number; fixing: "STANDARD" | "CHEMICAL" };
export type PfiShippingInput = PotenceShippingInput;
export type WallPotenceShippingInput = { family: "PMI" | "PMT"; capacityKg: number; spanM: number };

export type ShippingProductInput = {
  kind: "catalogue" | "configured";
  code?: string;
  supplier?: string;
  family?: string;
  weightKg?: number;
  packageLengthCm?: number;
  packageWidthCm?: number;
  packageHeightCm?: number;
  shippingMode?: ProductShippingMode;
  quantity?: number;
  pfiShipping?: PfiShippingInput;
  wallPotenceShipping?: WallPotenceShippingInput;
};

export type ShippingLineResult = {
  mode: ShippingMode;
  label: string;
  description: string;
  amountHT: number | null;
  weightKg?: number;
  zone?: number;
  coefficient?: number;
  rateCode?: string;
  bracket?: string;
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
