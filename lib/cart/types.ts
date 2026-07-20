export type CartItemKind = "catalogue" | "configured";

export type CartTechnicalLine = {
  label: string;
  value: string;
};

export type CartItem = {
  id: string;
  kind: CartItemKind;
  name: string;
  code?: string;
  family?: string;
  supplier?: string;
  weightKg?: number;
  shippingMode?: "INCLUDED" | "MESSAGERIE" | "AFFRETEMENT" | "QUOTE";
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
