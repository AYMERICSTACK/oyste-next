import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getProductImageUrl } from "@/lib/product-images";

export const dynamic = "force-dynamic";

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
  category: { slug: string; name: string } | null;
};

function formatPrice(product: SearchProduct) {
  const value = product.minPriceHt ?? product.priceHt;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "Sur configuration";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount) + " HT";
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
      category: { select: { slug: true, name: true } },
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
    products: products.map((product) => ({
      id: product.id,
      name: product.shortName || product.name,
      code: product.code,
      category: product.category?.name || "Catalogue OYSTE",
      href: `/catalogue/${product.category?.slug || "levage"}/${product.slug}`,
      image: getProductImageUrl(product.imageReference, product.code, product.supplierCode),
      price: formatPrice(product as SearchProduct),
      configurable: product.experienceType === "CONFIGURABLE",
    })),
    categories: Array.from(categoryMap.values()).slice(0, 4),
  });
}
