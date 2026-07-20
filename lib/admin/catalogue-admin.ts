import productsData from "@/data/catalogue/products.json";
import { getImportedProductDocumentsExact, getImportedProductImagesExact } from "@/lib/catalogue/media";
import type { CatalogueProduct } from "@/lib/catalogue/repository";
import { prisma } from "@/lib/db/prisma";

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


export async function getAdminCatalogueProductFromDatabase(id: string): Promise<AdminCatalogueProduct | undefined> {
  const product = await prisma.product.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: {
      supplier: true,
      category: true,
      variants: { orderBy: { code: "asc" } },
      features: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!product) return undefined;

  const fallback = getAdminCatalogueProduct(id);
  const images = getImportedProductImagesExact(product.imageReference || fallback?.imageRef || "", product.code);
  const documents = getImportedProductDocumentsExact(product.imageReference || fallback?.imageRef || "", product.code);
  const statusMap = { PUBLISHED: "Publié", DRAFT: "Brouillon", HIDDEN: "Masqué", ARCHIVED: "Masqué" } as const;
  const filled = [product.name, product.description, product.detailedDescription, Number(product.priceHt), images.length, product.features.length].filter(Boolean).length;

  return {
    ...(fallback || ({} as CatalogueProduct)),
    id: product.id,
    code: product.code,
    supplierCode: product.supplierCode || "",
    parentCode: product.parentCode || "",
    slug: product.slug,
    name: product.name,
    shortName: product.shortName || product.name,
    manufacturer: product.supplier?.name || fallback?.manufacturer || "OYSTE",
    categorySlug: product.category?.slug || fallback?.categorySlug || "",
    categoryPath: product.category?.path || product.category?.name || fallback?.categoryPath || "",
    categories: fallback?.categories || [],
    description: product.description || "",
    detailedDescription: product.detailedDescription || "",
    priceHT: Number(product.priceHt),
    minPriceHT: product.minPriceHt === null ? null : Number(product.minPriceHt),
    maxPriceHT: product.maxPriceHt === null ? null : Number(product.maxPriceHt),
    delay: product.leadTime || "",
    stock: product.stock,
    weightKg: product.weightKg === null ? null : Number(product.weightKg),
    shippingMode: product.shippingMode,
    imageRef: product.imageReference || "",
    features: product.features.map((feature) => ({ label: feature.label, value: feature.value })),
    variantCount: product.variants.length || 1,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      code: variant.code,
      supplierCode: variant.supplierCode || "",
      name: variant.name,
      label: variant.label || variant.name,
      priceHT: Number(variant.priceHt),
      delay: variant.leadTime || "",
      stock: variant.stock,
      weightKg: variant.weightKg === null ? null : Number(variant.weightKg),
      shippingMode: variant.shippingMode ?? undefined,
      imageRef: variant.imageReference || "",
      features: [],
      options: {},
    })),
    href: `/catalogue/${product.category?.slug || fallback?.categorySlug || "produit"}/${product.slug}`,
    experienceType: product.experienceType,
    configuratorFamily: product.configuratorFamily,
    marketingBadges: Array.isArray(product.marketingBadges) ? product.marketingBadges.filter((item): item is string => typeof item === "string") : [],
    relatedProductCodes: Array.isArray(product.relatedProductCodes) ? product.relatedProductCodes.filter((item): item is string => typeof item === "string") : [],
    accessoryProductCodes: Array.isArray(product.accessoryProductCodes) ? product.accessoryProductCodes.filter((item): item is string => typeof item === "string") : [],
    status: statusMap[product.publicationStatus],
    images,
    documentCount: documents.length,
    completeness: Math.round((filled / 6) * 100),
  };
}
