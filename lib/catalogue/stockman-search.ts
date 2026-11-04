import { formatStockmanSellingPrice } from "@/lib/catalogue/stockman-selling-prices";

import "server-only";
import fs from "node:fs";
import path from "node:path";

type StockmanProduct = {
  reference: string;
  title: string;
  category: string;
  subcategory: string;
  imageUrl: string;
};

export type StockmanSearchResult = {
  id: string;
  name: string;
  code: string;
  category: string;
  href: string;
  image: string;
  price: string;
  configurable: boolean;
};

let cachedProducts: StockmanProduct[] | null = null;

function getProducts(): StockmanProduct[] {
  if (cachedProducts) return cachedProducts;

  const file = path.join(
    process.cwd(),
    "data", "stockman", "catalogue-produits.json"
  );

  const data = JSON.parse(
    fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")
  ) as { products: StockmanProduct[] };

  cachedProducts = data.products;
  return cachedProducts;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .trim();
}

export function searchStockmanProducts(
  query: string,
  existingCodes: string[],
  limit = 12
): StockmanSearchResult[] {
  const normalized = normalize(query);

  if (normalized.length < 2) return [];

  const existing = new Set(
    existingCodes.map(code => normalize(code))
  );

  // STOCKMAN_EXCLUDE_PLV_V55
  const excludedReferences = new Set([
    "TOTEMCHARIOT",
    "TOTEMCRIC",
    "TOTEMDIABLE",
    "TOTEMPALAN"
  ]);

  return getProducts()
    .filter(product =>
      !excludedReferences.has(product.reference.trim().toUpperCase())
    )
    .filter(product => {
      if (existing.has(normalize(product.reference))) {
        return false;
      }

      const text = normalize([
        product.reference,
        product.title,
        product.category,
        product.subcategory
      ].join(" "));

      return text.includes(normalized);
    })
    .slice(0, limit)
    .map(product => ({
      id: "stockman-" + product.reference,
      name: product.title,
      code: product.reference,
      category: product.subcategory || product.category || "Catalogue OYSTE",
      href: "/catalogue/stockman/" +
        encodeURIComponent(product.reference),
      image: product.imageUrl,
      price: formatStockmanSellingPrice(product.reference),
      configurable: false
    }));
}
