"use client";

import { useEffect, useMemo, useState } from "react";
import type { CartItem } from "./types";
import { calculateCartShipping } from "@/lib/shipping";
import type { ShippingCartResult } from "@/lib/shipping/types";

export function useShippingQuote(items: CartItem[], postcode: string, country = "FR") {
  const local = useMemo(() => calculateCartShipping(items, postcode), [items, postcode]);
  const [remote, setRemote] = useState<ShippingCartResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!/^\d{5}$/.test(postcode) || !items.length) {
      setRemote(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/shipping/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items, postalCode: postcode, country }),
          signal: controller.signal,
        });
        const payload = await response.json() as { shipping?: ShippingCartResult };
        if (response.ok && payload.shipping) setRemote(payload.shipping);
        else setRemote(null);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setRemote(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [items, postcode, country]);

  return { shipping: remote || local, loading };
}
