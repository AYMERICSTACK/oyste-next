"use client";
import { useCommercialTexts } from "@/components/layout/CommercialTextProvider";

import { useRef, useState } from "react";
import { CheckCircle2, ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart/cart-store";
import type { CartTechnicalLine } from "@/lib/cart/types";

export default function AddToCartButton({
  name,
  code,
  family,
  supplier,
  weightKg,
  shippingMode,
  imageUrl,
  priceHT,
  delay,
  href,
  technicalLines = [],
  label = "Ajouter au panier",
  cartItemId,
  className = "",
}: {
  name: string;
  code?: string;
  family?: string;
  supplier?: string;
  weightKg?: number;
  shippingMode?: "INCLUDED" | "MESSAGERIE" | "AFFRETEMENT" | "QUOTE";
  imageUrl?: string;
  priceHT: number;
  delay?: string;
  href?: string;
  technicalLines?: CartTechnicalLine[];
  label?: string;
  cartItemId?: string;
  className?: string;
}) {
  const { addItem, items } = useCart();
  const [added, setAdded] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkingRef = useRef(false);

  // OYSTE_STOCKMAN_LIVE_CART_CHECK_V1
  async function handleClick() {
    if (checkingRef.current) return;
    setError(null);

    if (supplier?.trim().toUpperCase() === "STOCKMAN") {
      checkingRef.current = true;
      setChecking(true);

      try {
        if (!code?.trim()) {
          setError("Référence fournisseur manquante. Demandez un devis.");
          return;
        }

        const reference = code.trim().toUpperCase();
        const alreadyInCart = items
          .filter(
            (item) =>
              item.kind === "catalogue" &&
              item.supplier?.trim().toUpperCase() === "STOCKMAN" &&
              item.code?.trim().toUpperCase() === reference,
          )
          .reduce((sum, item) => sum + item.quantity, 0);

        const response = await fetch("/api/catalogue/stockman/check-add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            code: reference,
            quantity: alreadyInCart + 1,
          }),
        });

        const result = (await response.json()) as {
          allowed?: boolean;
          reason?: string;
          stockAvailable?: number;
        };

        if (!response.ok || result.allowed !== true) {
          const messages: Record<string, string> = {
            insufficient_stock:
              "Stock fournisseur insuffisant pour la quantité demandée.",
            freight_not_validated:
              "Transport à confirmer. Demandez un devis.",
            sale_price_missing:
              "Prix de vente à confirmer. Demandez un devis.",
            blocked:
              "Cet article n'est plus disponible à la commande.",
            unconfirmed_stock:
              "Stock fournisseur non confirmé. Demandez un devis.",
            supplier_unavailable:
              "STOCKMAN est temporairement inaccessible. Réessayez ou demandez un devis.",
            source_url_missing:
              "Fiche fournisseur introuvable. Demandez un devis.",
            product_not_found:
              "Référence fournisseur non reconnue. Demandez un devis.",
            ambiguous_reference:
              "Référence à vérifier. Demandez un devis.",
          };

          setError(
            messages[result.reason || ""] ||
              "Disponibilité non confirmée. Demandez un devis.",
          );
          return;
        }
      } catch {
        setError(
          "Impossible de vérifier le stock STOCKMAN. Aucun article ajouté.",
        );
        return;
      } finally {
        checkingRef.current = false;
        setChecking(false);
      }
    }

    addItem({
      id: cartItemId,
      kind: "catalogue",
      name,
      code,
      family,
      supplier,
      weightKg,
      shippingMode,
      stockmanFreightConfirmed: supplier?.trim().toUpperCase() === "STOCKMAN" && shippingMode === "INCLUDED",
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
    <>
    <button
      type="button"
      onClick={handleClick}
      disabled={checking}
      aria-busy={checking}
      className={`inline-flex items-center justify-center gap-3 rounded-xl px-7 py-4 text-sm font-black uppercase tracking-tight text-white shadow-xl transition ${
        added ? "bg-[#007f8f] shadow-[#007f8f]/20" : "bg-orange-600 shadow-orange-600/20 hover:bg-orange-700"
      } ${className}`}
    >
      {added ? <CheckCircle2 size={18} /> : <ShoppingCart size={18} />}
      {checking ? "Ajout en cours..." : added ? "Ajouté" : label}
    </button>
    {error && (
      <p role="alert" className="mt-2 text-sm font-semibold text-amber-800">
        {error}
      </p>
    )}
    </>
  );
}
