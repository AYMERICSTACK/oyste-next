import { AlertTriangle, Boxes, CheckCircle2, FileEdit } from "lucide-react";
import CatalogueManager from "@/components/admin/CatalogueManager";
import CategoryDeletionManager from "@/components/admin/CategoryDeletionManager";
import ExcelCategorySyncCard from "@/components/admin/ExcelCategorySyncCard";
import { prisma } from "@/lib/db/prisma";
import { getAdminCatalogueProductsFromDatabase, getAdminCatalogueStats } from "@/lib/admin/catalogue-admin";

export default async function CataloguePage({
  searchParams,
}: {
  searchParams?: Promise<{ fournisseur?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const initialSupplier = resolvedSearchParams?.fournisseur ?? "Tous";
  const [adminCatalogueProducts, categories] = await Promise.all([
    getAdminCatalogueProductsFromDatabase(),
    prisma.category.findMany({
      select: {
        id: true,
        name: true,
        path: true,
        _count: { select: { products: true, children: true } },
      },
      orderBy: [{ path: "asc" }, { name: "asc" }],
    }),
  ]);
  const adminCatalogueStats = getAdminCatalogueStats(adminCatalogueProducts);
  const cards = [
    { icon: Boxes, value: adminCatalogueStats.total, label: "Produits au catalogue" },
    { icon: CheckCircle2, value: adminCatalogueStats.published, label: "Produits publiés" },
    { icon: FileEdit, value: adminCatalogueStats.drafts, label: "Brouillons" },
    { icon: AlertTriangle, value: adminCatalogueStats.incomplete, label: "Fiches à compléter" },
  ];
  return <main className="mx-auto w-full max-w-[1600px] p-4 md:p-7 xl:p-9"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-600">Administration e-commerce</p><h1 className="mt-2 text-3xl font-black md:text-4xl">Catalogue produits</h1><p className="mt-2 text-sm text-slate-500">Créez, enrichissez, publiez et mettez à jour toutes les références visibles sur le site.</p></div><section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ icon: Icon, value, label }) => <article key={label} className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm"><Icon size={20} className="text-[#007f8f]" /><p className="mt-4 text-3xl font-black">{value}</p><p className="mt-1 text-xs font-bold text-slate-500">{label}</p></article>)}</section><ExcelCategorySyncCard /><CategoryDeletionManager categories={categories.map((category) => ({
    id: category.id,
    name: category.name,
    path: category.path || category.name,
    productCount: category._count.products,
    childCount: category._count.children,
  }))} /><CatalogueManager products={adminCatalogueProducts} initialSupplier={initialSupplier} /></main>;
}
