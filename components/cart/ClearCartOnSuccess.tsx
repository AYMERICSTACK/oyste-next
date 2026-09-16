"use client";
import { useEffect } from "react";
import { useCart } from "@/lib/cart/cart-store";
export default function ClearCartOnSuccess({ enabled }: { enabled: boolean }) {
  const { clearCart } = useCart();
  useEffect(() => { if (enabled) clearCart(); }, [clearCart, enabled]);
  return null;
}
