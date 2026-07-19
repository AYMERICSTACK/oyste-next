import productsData from "@/data/catalogue/products.json";
import { getImportedProductDocumentsExact, getImportedProductImagesExact } from "@/lib/catalogue/media";
import type { CatalogueProduct } from "@/lib/catalogue/repository";

export type AdminCatalogueProduct = CatalogueProduct & {
  status: "Publié" | "Brouillon" | "Masqué";
  images: string[];
  documentCount: number;
  completeness: number;
};

const products = productsData as CatalogueProduct[];

function enrich(product: CatalogueProduct, index: number): AdminCatalogueProduct {
  const images = getImportedProductImagesExact(product.imageRef, product.code);
  const documents = getImportedProductDocumentsExact(product.imageRef, product.code);
  const filled = [product.name, product.description, product.detailedDescription, product.priceHT, images.length, product.features?.length].filter(Boolean).length;
  return {
    ...product,
    status: index % 19 === 0 ? "Masqué" : index % 11 === 0 ? "Brouillon" : "Publié",
    images,
    documentCount: documents.length,
    completeness: Math.round((filled / 6) * 100),
  };
}

export const adminCatalogueProducts = products.map(enrich);

export function getAdminCatalogueProduct(id: string) {
  return adminCatalogueProducts.find((product) => product.id === id || product.slug === id);
}

export const adminCatalogueStats = {
  total: adminCatalogueProducts.length,
  published: adminCatalogueProducts.filter((product) => product.status === "Publié").length,
  drafts: adminCatalogueProducts.filter((product) => product.status === "Brouillon").length,
  incomplete: adminCatalogueProducts.filter((product) => product.completeness < 70).length,
};
