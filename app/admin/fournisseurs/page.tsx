import { AlertTriangle, Building2, CheckCircle2, Package } from "lucide-react";
import SuppliersWorkspace from "@/components/admin/SuppliersWorkspace";
import { getAdminSuppliersFromDatabase, getSupplierStats } from "@/lib/admin/suppliers-data";
import { getStockmanConnectionStatus } from "@/lib/suppliers/stockman/status";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const [stockmanStatus, adminSuppliers] = await Promise.all([
    getStockmanConnectionStatus(),
    getAdminSuppliersFromDatabase(),
  ]);
  const supplierStats = getSupplierStats(adminSuppliers);
  const cards = [
    { icon: Building2, value: supplierStats.total, label: "Fournisseurs référencés" },
    { icon: CheckCircle2, value: supplierStats.active, label: "Fournisseurs actifs" },
    { icon: Package, value: supplierStats.products, label: "Produits associés" },
    { icon: AlertTriangle, value: supplierStats.incomplete, label: "Fiches à compléter" },
  ];

  return (
    <main className="mx-auto w-full max-w-[1600px] p-4 md:p-7 xl:p-9">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-600">
            Référentiel catalogue
          </p>
          <h1 className="mt-2 text-3xl font-black md:text-4xl">Fournisseurs</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Un espace unique pour piloter chaque fournisseur : produits, imports, synchronisation, pricing et connexion.
          </p>
        </div>
        <div className="rounded-full border border-cyan-100 bg-cyan-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-800">
          V2.10.23.1 · Workspace fournisseurs
        </div>
      </div>

      <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ icon: Icon, value, label }) => (
          <article key={label} className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm">
            <Icon size={20} className="text-[#007f8f]" />
            <p className="mt-4 text-3xl font-black">{value}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">{label}</p>
          </article>
        ))}
      </section>

      <SuppliersWorkspace suppliers={adminSuppliers} stockmanStatus={stockmanStatus} />
    </main>
  );
}
