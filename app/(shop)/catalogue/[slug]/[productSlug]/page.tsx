import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getDatabaseProductBySlug } from "@/lib/catalogue/database-repository";
import { getCustomerProductDescription, getProductMediaImages } from "@/lib/catalogue/repository";
import CatalogProductDetail from "@/components/catalogue/CatalogProductDetail";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; productSlug: string }>;
}): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const product = await getDatabaseProductBySlug(slug, productSlug);

  if (!product) return {};

  const title = product.seoTitle?.trim() || `${product.name} | OYSTE`;
  const description = product.seoDescription?.trim() || getCustomerProductDescription(product);
  const images = getProductMediaImages(product);

  return {
    title,
    description,
    alternates: {
      canonical: product.href,
    },
    openGraph: {
      title,
      description,
      type: "website",
      images: images[0] ? [{ url: images[0], alt: product.name }] : undefined,
    },
  };
}

export default async function CatalogProductPage({ params, searchParams }: {
  params: Promise<{ slug: string; productSlug: string }>;
  searchParams: Promise<{ variant?: string | string[] }>;
}) {
  const { slug, productSlug } = await params;
  const query = await searchParams;
  const product = await getDatabaseProductBySlug(slug, productSlug);
  if (!product) notFound();
  if (product.categorySlug && slug !== product.categorySlug) redirect(`/catalogue/${product.categorySlug}/${product.slug}`);
  return <CatalogProductDetail product={product} initialVariantCode={Array.isArray(query.variant) ? query.variant[0] : query.variant} />;
}
