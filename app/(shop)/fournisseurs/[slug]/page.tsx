import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import Container from "@/components/ui/Container";
import CatalogProductGrid from "@/components/catalogue/CatalogProductGrid";
import { getDatabaseProductsBySupplier } from "@/lib/catalogue/database-repository";
export default async function SupplierPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supplier = await prisma.supplier.findUnique({ where: { slug } });
  if (!supplier?.isActive) return notFound();
  const products = await getDatabaseProductsBySupplier(slug);
  return <main className="bg-slate-50 py-10"><Container>{supplier.logoUrl && <img src={supplier.logoUrl} alt={supplier.name} className="mb-5 h-24 max-w-xs object-contain" />}<h1 className="text-4xl font-black">{supplier.name}</h1>{supplier.averageLeadTime && <p className="mt-3">{supplier.averageLeadTime}</p>}{supplier.website && <a href={supplier.website} rel="noopener noreferrer" target="_blank" className="mt-3 inline-block font-bold text-[#007f8f]">{supplier.website}</a>}<div className="mt-8"><CatalogProductGrid products={products} /></div></Container></main>;
}
