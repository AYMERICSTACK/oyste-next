import { AlertTriangle, Building2, CheckCircle2, Package } from "lucide-react";
import SuppliersManager from "@/components/admin/SuppliersManager";
import { adminSuppliers, supplierStats } from "@/lib/admin/suppliers-data";

export default function SuppliersPage() {
  const cards = [
    { icon: Building2, value: supplierStats.total, label: "Fournisseurs référencés" },
    { icon: CheckCircle2, value: supplierStats.active, label: "Fournisseurs actifs" },
    { icon: Package, value: supplierStats.products, label: "Produits associés" },
    { icon: AlertTriangle, value: supplierStats.incomplete, label: "Fiches à compléter" },
  ];
  return <main className="mx-auto w-full max-w-[1600px] p-4 md:p-7 xl:p-9"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-600">Référentiel catalogue</p><h1 className="mt-2 text-3xl font-black md:text-4xl">Fournisseurs</h1><p className="mt-2 text-sm text-slate-500">Centralisez les fabricants, leurs coordonnées et toutes les références qui leur sont rattachées.</p></div><section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ icon: Icon, value, label }) => <article key={label} className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm"><Icon size={20} className="text-[#007f8f]" /><p className="mt-4 text-3xl font-black">{value}</p><p className="mt-1 text-xs font-bold text-slate-500">{label}</p></article>)}</section><SuppliersManager suppliers={adminSuppliers} /></main>;
}
