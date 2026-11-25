import "server-only";
import type { CatalogueProduct, CatalogueVariant } from "./repository";
import { getStockmanNeonPrices } from "./stockman-neon-prices";
import { isStockmanSupplier } from "@/lib/suppliers/stockman/order-policy";

export async function applyStockmanSalePricesToCatalogue(products: CatalogueProduct[]): Promise<CatalogueProduct[]> {
  const stockman = products.filter(product => isStockmanSupplier(product.manufacturer));
  if (!stockman.length) return products;
  const references = (product: { supplierCode: string; code: string }) => [product.supplierCode, product.code].map(ref => ref?.trim().toUpperCase() || "");
  const refs = stockman.flatMap(product => [product, ...(product.variants ?? []), ...(product.baseVariants ?? [])].flatMap(references));
  const prices = await getStockmanNeonPrices(refs).catch(() => new Map<string, number>());
  const salePrice = (product: { supplierCode: string; code: string }) => {
    const [supplierReference, catalogueCode] = references(product);
    return prices.get(supplierReference) ?? prices.get(catalogueCode) ?? null;
  };
  const mapVariant = (v: CatalogueVariant): CatalogueVariant => ({ ...v, priceHT: salePrice(v) });
  return products.map(product => {
    if (!isStockmanSupplier(product.manufacturer)) return product;
    const priceHT = salePrice(product);
    const variants = product.variants?.map(mapVariant);
    const values = (variants?.length ? variants.map(v => v.priceHT) : [priceHT]).filter((v): v is number => v !== null);
    return { ...product, priceHT, minPriceHT: values.length ? Math.min(...values) : null,
      maxPriceHT: values.length ? Math.max(...values) : null, variants, baseVariants: product.baseVariants?.map(mapVariant) };
  });
}

export async function applyStockmanSalePrices(product: CatalogueProduct): Promise<CatalogueProduct> {
  const [priced] = await applyStockmanSalePricesToCatalogue([product]);
  return priced;
}
