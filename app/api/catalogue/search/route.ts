import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getProductImageUrl } from "@/lib/product-images";

export const dynamic = "force-dynamic";

type SearchVariant = {
  id: string;
  code: string;
  supplierCode: string | null;
  name: string;
  label: string | null;
  priceHt: unknown;
  imageReference: string | null;
};

type SearchProduct = {
  id: string;
  name: string;
  shortName: string | null;
  code: string;
  supplierCode: string | null;
  slug: string;
  imageReference: string | null;
  priceHt: unknown;
  minPriceHt: unknown;
  experienceType: "STANDARD" | "CONFIGURABLE";
  category: { slug: string; name: string; path: string | null } | null;
  variants: SearchVariant[];
};

function formatAmount(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "Sur configuration";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount) + " HT";
}

function formatPrice(product: SearchProduct, matchedVariant: SearchVariant | null) {
  if (matchedVariant) return formatAmount(matchedVariant.priceHt);
  return formatAmount(product.minPriceHt ?? product.priceHt);
}

function normalizeSearchValue(value: string | null | undefined) {
  return (value || "").trim().toLocaleLowerCase("fr");
}

function getCatalogueUniverseSlug(product: SearchProduct) {
  const source = `${product.category?.path || ""} ${product.category?.name || ""}`.toLocaleLowerCase("fr");
  if (source.includes("levage")) return "levage";
  if (source.includes("manutention au sol")) return "manutention-au-sol";
  if (source.includes("motorisation sew")) return "motorisation-sew";
  if (source.includes("stockage") || source.includes("emballage")) return "stockage-emballage";
  if (source.includes("accès en hauteur") || source.includes("acces en hauteur")) return "acces-hauteur";
  return product.category?.slug || "levage";
}

function findMatchedVariant(product: SearchProduct, query: string) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return null;
  const exact = product.variants.find((variant) =>
    [variant.code, variant.supplierCode].some((value) => normalizeSearchValue(value) === normalizedQuery),
  );
  if (exact) return exact;
  return product.variants.find((variant) =>
    [variant.code, variant.supplierCode].some((value) => normalizeSearchValue(value).includes(normalizedQuery)),
  ) || null;
}

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") || "").trim().slice(0, 80);
  if (query.length < 2) return NextResponse.json({ query, products: [], categories: [] });

  const products = await prisma.product.findMany({
    where: {
      publicationStatus: "PUBLISHED",
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { shortName: { contains: query, mode: "insensitive" } },
        { code: { contains: query, mode: "insensitive" } },
        { supplierCode: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { category: { name: { contains: query, mode: "insensitive" } } },
        { variants: { some: { code: { contains: query, mode: "insensitive" } } } },
        { variants: { some: { supplierCode: { contains: query, mode: "insensitive" } } } },
      ],
    },
    select: {
      id: true,
      name: true,
      shortName: true,
      code: true,
      supplierCode: true,
      slug: true,
      imageReference: true,
      priceHt: true,
      minPriceHt: true,
      experienceType: true,
      category: { select: { slug: true, name: true, path: true } },
      variants: {
        where: { OR: [
          { code: { contains: query, mode: "insensitive" } },
          { supplierCode: { contains: query, mode: "insensitive" } },
        ] },
        select: { id: true, code: true, supplierCode: true, name: true, label: true, priceHt: true, imageReference: true },
        orderBy: { code: "asc" },
        take: 8,
      },
    },
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    take: 8,
  });

  const categoryMap = new Map<string, { title: string; href: string; count: number }>();
  for (const product of products) {
    if (!product.category) continue;
    const current = categoryMap.get(product.category.slug);
    categoryMap.set(product.category.slug, {
      title: product.category.name,
      href: `/catalogue/${product.category.slug}`,
      count: (current?.count || 0) + 1,
    });
  }

  return NextResponse.json({
    query,
    products: products.map((product) => {
      const searchProduct = product as SearchProduct;
      const matchedVariant = findMatchedVariant(searchProduct, query);
      return {
        id: matchedVariant ? `${product.id}:${matchedVariant.id}` : product.id,
        name: product.shortName || product.name,
        code: matchedVariant?.code || product.code,
        category: product.category?.name || "Catalogue OYSTE",
        href: matchedVariant
          ? `/catalogue/${getCatalogueUniverseSlug(searchProduct)}/${product.slug}?variant=${encodeURIComponent(matchedVariant.code)}`
          : `/catalogue/${getCatalogueUniverseSlug(searchProduct)}/${product.slug}`,
        image: getProductImageUrl(matchedVariant?.imageReference || product.imageReference, matchedVariant?.code || product.code, matchedVariant?.supplierCode || product.supplierCode),
        price: formatPrice(searchProduct, matchedVariant),
        configurable: product.experienceType === "CONFIGURABLE",
      };
    }),
    categories: Array.from(categoryMap.values()).slice(0, 4),
  });
}
