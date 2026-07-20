import { notFound } from "next/navigation";
import ProductEditor from "@/components/admin/ProductEditor";
import { getAdminCatalogueProductFromDatabase } from "@/lib/admin/catalogue-admin";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getAdminCatalogueProductFromDatabase(decodeURIComponent(id));
  if (!product) notFound();
  return <ProductEditor product={product} />;
}
