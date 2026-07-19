"use client";

import { useState } from "react";
import { CheckCircle2, ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart/cart-store";
import type { CartTechnicalLine } from "@/lib/cart/types";

export default function AddToCartButton({
  name,
  code,
  family,
  imageUrl,
  priceHT,
  delay,
  href,
  technicalLines = [],
  label = "Ajouter au panier",
  className = "",
}: {
  name: string;
  code?: string;
  family?: string;
  imageUrl?: string;
  priceHT: number;
  delay?: string;
  href?: string;
  technicalLines?: CartTechnicalLine[];
  label?: string;
  className?: string;
}) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  function handleClick() {
    addItem({
      kind: "catalogue",
      name,
      code,
      family,
      imageUrl,
      unitPriceHT: priceHT,
      delay,
      href,
      technicalLines,
      quantity: 1,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center justify-center gap-3 rounded-xl px-7 py-4 text-sm font-black uppercase tracking-tight text-white shadow-xl transition ${
        added ? "bg-[#007f8f] shadow-[#007f8f]/20" : "bg-orange-600 shadow-orange-600/20 hover:bg-orange-700"
      } ${className}`}
    >
      {added ? <CheckCircle2 size={18} /> : <ShoppingCart size={18} />}
      {added ? "Ajouté" : label}
    </button>
  );
}
