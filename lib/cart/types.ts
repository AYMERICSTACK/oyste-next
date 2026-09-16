export type CartItemKind = "catalogue" | "configured";

export type CartTechnicalLine = {
  label: string;
  value: string;
};

export type PotenceShippingConfiguration = { family?: "PFI" | "PFT"; capacityKg: number; spanM: number; hsfM: number; fixing: "STANDARD" | "CHEMICAL" };
export type PfiShippingConfiguration = PotenceShippingConfiguration;
export type WallPotenceShippingConfiguration = { family: "PMI" | "PMT"; capacityKg: number; spanM: number; additionalWeightKg?: number; weightComplete?: boolean };

export type CartItem = {
  id: string;
  kind: CartItemKind;
  name: string;
  code?: string;
  family?: string;
  supplier?: string;
  weightKg?: number;
  packageLengthCm?: number;
  packageWidthCm?: number;
  packageHeightCm?: number;
  shippingMode?: "INCLUDED" | "MESSAGERIE" | "AFFRETEMENT" | "QUOTE";
  pfiShipping?: PfiShippingConfiguration;
  wallPotenceShipping?: WallPotenceShippingConfiguration;
  imageUrl?: string;
  unitPriceHT: number;
  quantity: number;
  delay?: string;
  href?: string;
  editHref?: string;
  technicalLines?: CartTechnicalLine[];
  addedAt: string;
};

export type CartTotals = {
  itemCount: number;
  subtotalHT: number;
  estimatedShippingHT: number | null;
  vat: number;
  totalTTC: number;
};
