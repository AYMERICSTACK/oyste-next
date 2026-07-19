"use client";

import { useState } from "react";
import { CheckCircle2, ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart/cart-store";
import type { CartTechnicalLine } from "@/lib/cart/types";

export default function ConfiguredCartButton({
  name,
  code,
  priceHT,
  editHref,
  technicalLines,
}: {
  name: string;
  code?: string;
  priceHT: number;
  editHref: string;
  technicalLines: CartTechnicalLine[];
}) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  function handleClick() {
    addItem({
      kind: "configured",
      name,
      code,
      family: "Potence configurée",
      unitPriceHT: priceHT,
      quantity: 1,
      delay: "Fabrication selon configuration",
      href: "/configurateur/resultat",
      editHref,
      technicalLines,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`mt-5 inline-flex w-full items-center justify-center gap-3 rounded-xl px-5 py-4 text-sm font-black uppercase text-white transition ${
        added ? "bg-[#007f8f]" : "bg-orange-600 hover:bg-orange-700"
      }`}
    >
      {added ? <CheckCircle2 size={19} /> : <ShoppingCart size={19} />}
      {added ? "Solution ajoutée" : "Ajouter cette solution au panier"}
    </button>
  );
}
