"use client";
import { useEffect } from "react";
import { useCart } from "@/lib/cart/cart-store";
export default function ClearCartOnSuccess({ enabled }: { enabled: boolean }) {
  const { clearCart } = useCart();
  useEffect(() => {
    if (!enabled) return;
    sessionStorage.removeItem("oyste-checkout-postcode");
    clearCart();
  }, [clearCart, enabled]);
  return null;
}
