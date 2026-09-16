import productsData from "@/data/catalogue/products.json";
import {
  getImportedProductDocumentsExact,
  getImportedProductImagesExact,
} from "@/lib/catalogue/media";
import {
  getNormalizedCategorySlug,
  type CatalogueProduct,
} from "@/lib/catalogue/repository";
import { prisma } from "@/lib/db/prisma";
import type { StockmanProductSyncTarget } from "@/lib/suppliers/stockman/types";
import type { Prisma } from "@/generated/prisma/client";

export type AdminCatalogueProduct = CatalogueProduct & {
  status: "Publié" | "Brouillon" | "Masqué";
  images: string[];
  documentCount: number;
  completeness: number;
  stockmanSyncTargets: StockmanProductSyncTarget[];
};

const products = productsData as CatalogueProduct[];

function enrich(
  product: CatalogueProduct,
  index: number,
): AdminCatalogueProduct {
  const images = getImportedProductImagesExact(product.imageRef, product.code);
  const documents = getImportedProductDocumentsExact(
    product.imageRef,
    product.code,
  );
  const filled = [
    product.name,
    product.description,
    product.detailedDescription,
    product.priceHT,
    images.length,
    product.features?.length,
  ].filter(Boolean).length;
  return {
    ...product,
    status:
      index % 19 === 0 ? "Masqué" : index % 11 === 0 ? "Brouillon" : "Publié",
    images,
    documentCount: documents.length,
    completeness: Math.round((filled / 6) * 100),
    stockmanSyncTargets: [],
  };
}

function stockmanSyncTarget(
  targetType: "product" | "variant",
  targetId: string,
  name: string,
  supplierCode: string | null,
  stock: number,
  weightKg: number | null,
  sourceData: Prisma.JsonValue | null,
): StockmanProductSyncTarget | null {
  if (
    !sourceData ||
    typeof sourceData !== "object" ||
    Array.isArray(sourceData)
  )
    return null;
  const stockman = (sourceData as Record<string, unknown>).stockman;
  if (!stockman || typeof stockman !== "object" || Array.isArray(stockman))
    return null;
  const source = stockman as Record<string, unknown>;
  const reference =
    typeof source.reference === "string"
      ? source.reference
      : supplierCode || "";
  const sourceUrl =
    typeof source.sourceUrl === "string" ? source.sourceUrl : "";
  if (!reference || !sourceUrl) return null;
  return {
    targetType,
    targetId,
    name,
    reference,
    designation:
      typeof source.designation === "string" ? source.designation : name,
    stock: typeof source.stock === "number" ? source.stock : stock,
    weightKg: typeof source.weightKg === "number" ? source.weightKg : weightKg,
    purchasePriceExVat:
      typeof source.purchasePriceExVat === "number"
        ? source.purchasePriceExVat
        : null,
    sourceUrl,
    syncedAt: typeof source.syncedAt === "string" ? source.syncedAt : null,
  };
}

export const adminCatalogueProducts = products.map(enrich);

export function getAdminCatalogueProduct(id: string) {
  return adminCatalogueProducts.find(
    (product) => product.id === id || product.slug === id,
  );
}

export const adminCatalogueStats = {
  total: adminCatalogueProducts.length,
  published: adminCatalogueProducts.filter(
    (product) => product.status === "Publié",
  ).length,
  drafts: adminCatalogueProducts.filter(
    (product) => product.status === "Brouillon",
  ).length,
  incomplete: adminCatalogueProducts.filter(
    (product) => product.completeness < 70,
  ).length,
};


export async function getAdminCatalogueProductsFromDatabase(): Promise<AdminCatalogueProduct[]> {
  const databaseProducts = await prisma.product.findMany({
    include: {
      supplier: true,
      category: true,
      variants: { orderBy: { code: "asc" } },
      features: { orderBy: { sortOrder: "asc" } },
      media: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      documents: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const statusMap = {
    PUBLISHED: "Publié",
    DRAFT: "Brouillon",
    HIDDEN: "Masqué",
    ARCHIVED: "Masqué",
  } as const;

  return databaseProducts.map((product) => {
    const importedImages = getImportedProductImagesExact(
      product.imageReference || "",
      product.code,
    );
    const importedDocuments = getImportedProductDocumentsExact(
      product.imageReference || "",
      product.code,
    );
    const images = product.media.length
      ? product.media.map((media) => media.url)
      : importedImages;
    const documentCount = product.documents.length || importedDocuments.length;
    const categoryPath = product.category?.path || product.category?.name || "";
    const categorySlug = getNormalizedCategorySlug({
      ...(products[0] || ({} as CatalogueProduct)),
      categorySlug: product.category?.slug || "",
      categoryPath,
      name: product.name,
      code: product.code,
      parentCode: product.parentCode || "",
    } as CatalogueProduct);

    const filled = [
      product.name,
      product.description,
      product.detailedDescription,
      Number(product.priceHt) > 0 ? Number(product.priceHt) : null,
      images.length,
      product.features.length,
    ].filter(Boolean).length;

    const stockmanSyncTargets = [
      stockmanSyncTarget(
        "product",
        product.id,
        product.name,
        product.supplierCode,
        product.stock,
        product.weightKg === null ? null : Number(product.weightKg),
        product.sourceData,
      ),
      ...product.variants.map((variant) =>
        stockmanSyncTarget(
          "variant",
          variant.id,
          variant.label || variant.name,
          variant.supplierCode,
          variant.stock,
          variant.weightKg === null ? null : Number(variant.weightKg),
          variant.sourceData,
        ),
      ),
    ].filter((target): target is StockmanProductSyncTarget => target !== null);

    return {
      id: product.id,
      code: product.code,
      supplierCode: product.supplierCode || "",
      parentCode: product.parentCode || "",
      slug: product.slug,
      name: product.name,
      shortName: product.shortName || product.name,
      manufacturer: product.supplier?.name || "OYSTE",
      categorySlug,
      categoryPath,
      categories: categoryPath
        .split(/\|>|\\/g)
        .map((item) => item.trim())
        .filter(Boolean),
      description: product.description || "",
      detailedDescription: product.detailedDescription || "",
      seoTitle: product.seoTitle || "",
      seoDescription: product.seoDescription || "",
      priceHT: Number(product.priceHt),
      minPriceHT: product.minPriceHt === null ? null : Number(product.minPriceHt),
      maxPriceHT: product.maxPriceHt === null ? null : Number(product.maxPriceHt),
      delay: product.leadTime || "",
      stock: product.stock,
      weightKg: product.weightKg === null ? null : Number(product.weightKg),
      packageLengthCm: product.packageLengthCm === null ? null : Number(product.packageLengthCm),
      packageWidthCm: product.packageWidthCm === null ? null : Number(product.packageWidthCm),
      packageHeightCm: product.packageHeightCm === null ? null : Number(product.packageHeightCm),
      shippingMode: product.shippingMode,
      imageRef: product.imageReference || "",
      features: product.features.map((feature) => ({
        label: feature.label,
        value: feature.value,
      })),
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
        packageLengthCm: variant.packageLengthCm === null ? null : Number(variant.packageLengthCm),
        packageWidthCm: variant.packageWidthCm === null ? null : Number(variant.packageWidthCm),
        packageHeightCm: variant.packageHeightCm === null ? null : Number(variant.packageHeightCm),
        shippingMode: variant.shippingMode ?? undefined,
        imageRef: variant.imageReference || "",
        features: [],
        options: {},
      })),
      href: `/catalogue/${categorySlug || "produit"}/${product.slug}`,
      status: statusMap[product.publicationStatus],
      images,
      documentCount,
      completeness: Math.round((filled / 6) * 100),
      stockmanSyncTargets,
    } satisfies AdminCatalogueProduct;
  });
}

export function getAdminCatalogueStats(products: AdminCatalogueProduct[]) {
  return {
    total: products.length,
    published: products.filter((product) => product.status === "Publié").length,
    drafts: products.filter((product) => product.status === "Brouillon").length,
    incomplete: products.filter((product) => product.completeness < 70).length,
  };
}

export async function getAdminCatalogueProductFromDatabase(
  id: string,
): Promise<AdminCatalogueProduct | undefined> {
  const product = await prisma.product.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: {
      supplier: true,
      category: true,
      variants: { orderBy: { code: "asc" } },
      features: { orderBy: { sortOrder: "asc" } },
      media: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      documents: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!product) return undefined;

  const fallback = getAdminCatalogueProduct(id);
  const importedImages = getImportedProductImagesExact(
    product.imageReference || fallback?.imageRef || "",
    product.code,
  );
  const importedDocuments = getImportedProductDocumentsExact(
    product.imageReference || fallback?.imageRef || "",
    product.code,
  );
  const images = product.media.length
    ? product.media.map((media) => media.url)
    : importedImages;
  const documentCount = product.documents.length || importedDocuments.length;
  const statusMap = {
    PUBLISHED: "Publié",
    DRAFT: "Brouillon",
    HIDDEN: "Masqué",
    ARCHIVED: "Masqué",
  } as const;
  const filled = [
    product.name,
    product.description,
    product.detailedDescription,
    Number(product.priceHt),
    images.length,
    product.features.length,
  ].filter(Boolean).length;
  const stockmanSyncTargets = [
    stockmanSyncTarget(
      "product",
      product.id,
      product.name,
      product.supplierCode,
      product.stock,
      product.weightKg === null ? null : Number(product.weightKg),
      product.sourceData,
    ),
    ...product.variants.map((variant) =>
      stockmanSyncTarget(
        "variant",
        variant.id,
        variant.label || variant.name,
        variant.supplierCode,
        variant.stock,
        variant.weightKg === null ? null : Number(variant.weightKg),
        variant.sourceData,
      ),
    ),
  ].filter((target): target is StockmanProductSyncTarget => target !== null);

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
    categoryPath:
      product.category?.path ||
      product.category?.name ||
      fallback?.categoryPath ||
      "",
    categories: fallback?.categories || [],
    description: product.description || "",
    detailedDescription: product.detailedDescription || "",
    seoTitle: product.seoTitle || "",
    seoDescription: product.seoDescription || "",
    priceHT: Number(product.priceHt),
    minPriceHT: product.minPriceHt === null ? null : Number(product.minPriceHt),
    maxPriceHT: product.maxPriceHt === null ? null : Number(product.maxPriceHt),
    delay: product.leadTime || "",
    stock: product.stock,
    weightKg: product.weightKg === null ? null : Number(product.weightKg),
    packageLengthCm: product.packageLengthCm === null ? null : Number(product.packageLengthCm),
    packageWidthCm: product.packageWidthCm === null ? null : Number(product.packageWidthCm),
    packageHeightCm: product.packageHeightCm === null ? null : Number(product.packageHeightCm),
    shippingMode: product.shippingMode,
    imageRef: product.imageReference || "",
    features: product.features.map((feature) => ({
      label: feature.label,
      value: feature.value,
    })),
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
      packageLengthCm: variant.packageLengthCm === null ? null : Number(variant.packageLengthCm),
      packageWidthCm: variant.packageWidthCm === null ? null : Number(variant.packageWidthCm),
      packageHeightCm: variant.packageHeightCm === null ? null : Number(variant.packageHeightCm),
      shippingMode: variant.shippingMode ?? undefined,
      imageRef: variant.imageReference || "",
      features: [],
      options: {},
    })),
    href: `/catalogue/${getNormalizedCategorySlug({
      ...(fallback || ({} as CatalogueProduct)),
      categorySlug: product.category?.slug || fallback?.categorySlug || "",
      categoryPath:
        product.category?.path ||
        product.category?.name ||
        fallback?.categoryPath ||
        "",
      name: product.name,
      code: product.code,
      parentCode: product.parentCode || "",
    } as CatalogueProduct) || "produit"}/${product.slug}`,
    experienceType: product.experienceType,
    configuratorFamily: product.configuratorFamily,
    marketingBadges: Array.isArray(product.marketingBadges)
      ? product.marketingBadges.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    relatedProductCodes: Array.isArray(product.relatedProductCodes)
      ? product.relatedProductCodes.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    accessoryProductCodes: Array.isArray(product.accessoryProductCodes)
      ? product.accessoryProductCodes.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    status: statusMap[product.publicationStatus],
    images,
    documentCount,
    completeness: Math.round((filled / 6) * 100),
    stockmanSyncTargets,
  };
}
