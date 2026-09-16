"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartItem, CartTotals } from "./types";

const STORAGE_KEY = "oyste-cart-v1";
const VAT_RATE = 0.2;

function normalizeQuantity(quantity: number) {
  if (!Number.isFinite(quantity)) return 1;
  return Math.max(1, Math.min(99, Math.round(quantity)));
}

function makeLineId(item: Omit<CartItem, "id" | "addedAt">) {
  if (item.kind === "configured") return `configured:${item.code || item.name}:${Date.now()}`;
  return `catalogue:${item.code || item.name}`;
}

function readStoredCart(): CartItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item?.id && item?.name && Number.isFinite(item.unitPriceHT));
  } catch {
    return [];
  }
}

function calculateTotals(items: CartItem[]): CartTotals {
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotalHT = items.reduce((sum, item) => sum + item.unitPriceHT * item.quantity, 0);
  const estimatedShippingHT = 0;
  const vat = subtotalHT * VAT_RATE;

  return {
    itemCount,
    subtotalHT,
    estimatedShippingHT,
    vat,
    totalTTC: subtotalHT + estimatedShippingHT + vat,
  };
}

type AddCartItemInput = Omit<CartItem, "id" | "addedAt" | "quantity"> & {
  id?: string;
  quantity?: number;
};

type CartContextValue = {
  items: CartItem[];
  totals: CartTotals;
  addItem: (item: AddCartItemInput) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(readStoredCart());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [hydrated, items]);

  const addItem = useCallback((input: AddCartItemInput) => {
    const quantity = normalizeQuantity(input.quantity ?? 1);
    const baseItem = {
      ...input,
      quantity,
      addedAt: new Date().toISOString(),
    } satisfies Omit<CartItem, "id">;
    const id = input.id || makeLineId(baseItem);

    setItems((current) => {
      const existingIndex = current.findIndex((item) => item.id === id && item.kind === "catalogue");
      if (existingIndex >= 0) {
        return current.map((item, index) =>
          index === existingIndex
            ? { ...item, quantity: normalizeQuantity(item.quantity + quantity) }
            : item,
        );
      }

      return [{ ...baseItem, id }, ...current];
    });
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, quantity: normalizeQuantity(quantity) } : item)),
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setItems([]);
  }, []);

  const totals = useMemo(() => calculateTotals(items), [items]);

  const value = useMemo(
    () => ({ items, totals, addItem, updateQuantity, removeItem, clearCart }),
    [items, totals, addItem, updateQuantity, removeItem, clearCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}

export function formatCartPrice(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}
