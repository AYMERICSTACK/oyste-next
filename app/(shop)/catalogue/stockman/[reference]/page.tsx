import CatalogProductDetail from "@/components/catalogue/CatalogProductDetail";
import { buildStockmanLocalProduct } from "@/lib/catalogue/stockman-local-product";
import { isBlockedStockmanReference } from "@/lib/suppliers/stockman/order-policy";
import fs from "node:fs";
import path from "node:path";
import { notFound, redirect } from "next/navigation";
import { getDatabaseProductsBySupplier } from "@/lib/catalogue/database-repository";
import { resolvePresentedVariants } from "@/lib/catalogue/product-presentation";

export const dynamic = "force-dynamic";

type Product = { reference: string; title: string; category: string; subcategory: string; imageUrl: string; sourceUrl?: string };

export default async function StockmanProductPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const cataloguePath = path.join(process.cwd(), "data", "stockman", "catalogue-produits.json");
  const catalogue = JSON.parse(fs.readFileSync(cataloguePath, "utf8").replace(/^\uFEFF/, "")) as { products: Product[] };
  const product = catalogue.products.find(item => item.reference.toUpperCase() === reference.toUpperCase());
  if (!product || isBlockedStockmanReference(reference)) notFound();

  const code = product.reference.toUpperCase();
  // V275_CANONICAL_STOCKMAN
  // Les fiches OYSTE publiees restent la reference.
  // Une correspondance ambigue conserve la fiche existante.
  const existingProducts = await getDatabaseProductsBySupplier("stockman").catch(() => []);

  const destinations = new Set<string>();

  for (const existing of existingProducts) {
    const parentCodes = [
      existing.code,
      existing.supplierCode,
    ].map(value => String(value || "").trim().toUpperCase());

    let exactVariant = false;

    const publishedVariants = resolvePresentedVariants(existing, []);

    for (const variant of publishedVariants) {
      const variantCodes = [
        variant.code,
        variant.supplierCode,
      ].map(value => String(value || "").trim().toUpperCase());

      if (variantCodes.includes(code)) {
        exactVariant = true;
        destinations.add(
          existing.href +
          "?variant=" +
          encodeURIComponent(variant.code)
        );
      }
    }
    if (!exactVariant && parentCodes.includes(code)) destinations.add(existing.href);
  }

  if (destinations.size === 1) {
    const destination = [...destinations][0];

    if (destination.startsWith("/catalogue/") &&
        !destination.startsWith("/catalogue/stockman/")) {
      redirect(destination);
    }
  }
  const fallback = buildStockmanLocalProduct(product, catalogue.products);
  return <CatalogProductDetail product={fallback} initialVariantCode={code} local />;
}
