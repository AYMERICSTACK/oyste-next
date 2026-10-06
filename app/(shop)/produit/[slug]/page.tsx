import { notFound, redirect } from "next/navigation";
import { getDatabaseProductBySlug } from "@/lib/catalogue/database-repository";
export default async function LegacyProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getDatabaseProductBySlug("produit", slug);
  if (!product) return notFound();
  redirect(product.href);
}
