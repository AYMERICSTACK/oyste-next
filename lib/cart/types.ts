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
  estimatedShippingHT: number;
  vat: number;
  totalTTC: number;
};
