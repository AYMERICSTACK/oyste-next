"use client";
import { useEffect, useState } from "react";
import type { CartItem } from "./types";

export function useKitoAdjustment(items: CartItem[]) {
  const [adjustment, setAdjustment] = useState<{ discountHT: number; discountPercent: number; discountReason: "TRANSPORT" | "GROUPING" } | null>(null);
  useEffect(() => {
    if (!items.some((item) => /^KITO$/i.test(String(item.supplier || "")))) { setAdjustment(null); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/cart/kito-adjustment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }), signal: controller.signal });
        const payload = await response.json();
        if (response.ok) setAdjustment(payload.adjustment || null);
      } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setAdjustment(null); }
    }, 200);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [items]);
  return adjustment;
}
