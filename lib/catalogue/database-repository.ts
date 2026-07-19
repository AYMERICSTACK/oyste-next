import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  filterProductsByFamily,
  getNormalizedCategorySlug,
  normalizeCategoryQuery,
  type CatalogueFeature,
  type CatalogueOption,
  type CatalogueProduct,
  type CatalogueVariant,
} from "@/lib/catalogue/repository";

const catalogueProductInclude = {
  supplier: true,
  category: true,
  features: { orderBy: { sortOrder: "asc" as const } },
  variants: {
    orderBy: { code: "asc" as const },
    include: {
      features: { orderBy: { sortOrder: "asc" as const } },
    },
  },
} satisfies Prisma.ProductInclude;

type DatabaseProduct = Prisma.ProductGetPayload<{
  include: typeof catalogueProductInclude;
}>;

type SourceProductData = Partial<{
  categoryPath: string;
  categories: string[];
  manufacturer: string;
  href: string;
}>;

function asRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringRecord(value: Prisma.JsonValue | null): Record<string, string> {
  const source = asRecord(value);
  return Object.fromEntries(
    Object.entries(source).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function asOptionSchema(value: Prisma.JsonValue | null): CatalogueOption[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const option = item as Record<string, unknown>;
    if (typeof option.label !== "string" || !Array.isArray(option.values)) return [];

    return [{
      label: option.label,
      values: option.values.filter((entry): entry is string => typeof entry === "string"),
    }];
  });
}

function mapFeature(feature: { label: string; value: string }): CatalogueFeature {
  return { label: feature.label, value: feature.value };
}

function mapVariant(variant: DatabaseProduct["variants"][number]): CatalogueVariant {
  return {
    id: variant.id,
    code: variant.code,
    supplierCode: variant.supplierCode || "",
    name: variant.name,
    label: variant.label || variant.name,
    priceHT: Number(variant.priceHt),
    delay: variant.leadTime || "",
    stock: variant.stock,
    imageRef: variant.imageReference || "",
    features: variant.features.map(mapFeature),
    options: asStringRecord(variant.options),
  };
}

function mapDatabaseProduct(product: DatabaseProduct): CatalogueProduct {
  const source = asRecord(product.sourceData) as SourceProductData;
  const categoryPath = source.categoryPath || product.category?.path || product.category?.name || "";
  const categories = Array.isArray(source.categories)
    ? source.categories.filter((item): item is string => typeof item === "string")
    : categoryPath.split(/\\|>/g).map((item: string) => item.trim()).filter(Boolean);
  const variants = product.variants.map(mapVariant);

  const mapped: CatalogueProduct = {
    id: product.id,
    code: product.code,
    supplierCode: product.supplierCode || "",
    parentCode: product.parentCode || "",
    slug: product.slug,
    name: product.name,
    shortName: product.shortName || product.name,
    manufacturer: product.supplier?.name || source.manufacturer || "OYSTE",
    categorySlug: product.category?.slug || "",
    categoryPath,
    categories,
    description: product.description || "",
    detailedDescription: product.detailedDescription || "",
    priceHT: Number(product.priceHt),
    minPriceHT: product.minPriceHt === null ? null : Number(product.minPriceHt),
    maxPriceHT: product.maxPriceHt === null ? null : Number(product.maxPriceHt),
    delay: product.leadTime || "",
    stock: product.stock,
    imageRef: product.imageReference || "",
    features: product.features.map(mapFeature),
    variantCount: variants.length || 1,
    optionSchema: asOptionSchema(product.optionSchema),
    variants,
    href: source.href || "",
  };

  const categorySlug = getNormalizedCategorySlug(mapped);
  return {
    ...mapped,
    categorySlug,
    href: `/catalogue/${categorySlug}/${product.slug}`,
  };
}

export async function getDatabaseProductsByCategory(
  categorySlug: string,
  familySlug?: string,
): Promise<CatalogueProduct[]> {
  const normalizedSlug = normalizeCategoryQuery(categorySlug);
  const products = await prisma.product.findMany({
    where: {
      publicationStatus: "PUBLISHED",
      category: { slug: normalizedSlug },
    },
    include: catalogueProductInclude,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return filterProductsByFamily(products.map(mapDatabaseProduct), familySlug);
}

export async function getDatabaseProductBySlug(
  categorySlug: string,
  productSlug: string,
): Promise<CatalogueProduct | undefined> {
  const product = await prisma.product.findUnique({
    where: { slug: productSlug },
    include: catalogueProductInclude,
  });

  if (!product || product.publicationStatus !== "PUBLISHED") return undefined;

  const mapped = mapDatabaseProduct(product);
  return mapped.categorySlug === normalizeCategoryQuery(categorySlug) ? mapped : undefined;
}

export async function getDatabaseFeaturedProducts(limit = 6): Promise<CatalogueProduct[]> {
  const products = await prisma.product.findMany({
    where: { publicationStatus: "PUBLISHED" },
    include: catalogueProductInclude,
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  const mapped = products.map(mapDatabaseProduct);
  const priority = [
    "levage",
    "manutention-au-sol",
    "motorisation-sew",
    "stockage-emballage",
    "acces-hauteur",
  ];

  const selected = priority.flatMap((slug) =>
    mapped.filter((product: CatalogueProduct) => product.categorySlug === slug).slice(0, 2),
  );

  return selected.slice(0, limit);
}
