"use client";

import { ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart/cart-store";

export default function CartLink() {
  const { totals } = useCart();

  return (
    <a
      href="/panier"
      className="relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-950 transition hover:border-orange-500 hover:text-orange-600"
      aria-label="Voir le panier"
    >
      <ShoppingCart size={19} />
      {totals.itemCount > 0 ? (
        <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-orange-600 px-1.5 text-[11px] font-black text-white shadow-lg shadow-orange-600/30">
          {totals.itemCount}
        </span>
      ) : null}
    </a>
  );
}
