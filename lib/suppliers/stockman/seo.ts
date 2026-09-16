import type { StockmanProduct } from "@/lib/suppliers/stockman/types";

function clean(value: string | null | undefined) {
  return (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateAtWord(value: string, max: number) {
  const text = clean(value);
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const boundary = cut.lastIndexOf(" ");
  return `${(boundary >= Math.floor(max * 0.72) ? cut.slice(0, boundary) : text.slice(0, max)).trim()}…`;
}

function seoDesignation(value: string) {
  return clean(value)
    .replace(/\b(\d+(?:[,.]\d+)?)\s*tonnes?\b/gi, "$1 t")
    .replace(/\b(\d+(?:[,.]\d+)?)\s*t\b/gi, "$1 t")
    .replace(/\bgrande\s+lev[eé]e\s+libre\b/gi, "grande levée libre")
    .replace(/\s*,\s*/g, ", ");
}

export function buildStockmanSeo(product: StockmanProduct) {
  const designation = seoDesignation(product.designation);
  const suffix = " | OYSTE";
  const seoTitle = `${truncateAtWord(designation, 60 - suffix.length)}${suffix}`;

  // La meta description reste propre à la référence synchronisée. On part de la
  // désignation exacte (hauteur, batterie, capacité...) plutôt que du long texte
  // éditorial Stockman, qui peut être commun à toute une famille de variantes.
  const reference = clean(product.reference);
  const base = `${designation}. Réf. ${reference}. Matériel de manutention Stockman proposé par OYSTE.`;
  const seoDescription = truncateAtWord(base, 160);

  return { seoTitle, seoDescription };
}
