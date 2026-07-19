"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Building2, ChevronRight, FileText, ImageIcon, Package, Search } from "lucide-react";
import type { AdminSupplier } from "@/lib/admin/suppliers-data";

export default function SuppliersManager({ suppliers }: { suppliers: AdminSupplier[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Tous");
  const filtered = useMemo(() => suppliers.filter((supplier) => {
    const matchesQuery = `${supplier.name} ${supplier.email} ${supplier.website}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (status === "Tous" || supplier.status === status);
  }), [query, status, suppliers]);

  return <>
    <div className="mt-7 flex flex-col gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-slate-100 px-4 py-3"><Search size={18} className="text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un fournisseur…" className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-slate-400" /></div>
      <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600 outline-none"><option>Tous</option><option>Actif</option><option>À compléter</option></select>
      <button className="rounded-xl bg-[#007f8f] px-5 py-3 text-xs font-black text-white shadow-lg shadow-cyan-900/10">Nouveau fournisseur</button>
    </div>

    <section className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {filtered.map((supplier) => <article key={supplier.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white"><Building2 size={21} /></div><div className="min-w-0"><h2 className="truncate text-lg font-black">{supplier.name}</h2><p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{supplier.status}</p></div></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${supplier.status === "Actif" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{supplier.productCount} produits</span></div>
        <div className="mt-5 grid grid-cols-3 gap-2"><Metric icon={Package} value={supplier.publishedCount} label="Publiés" /><Metric icon={ImageIcon} value={supplier.imageCount} label="Photos" /><Metric icon={FileText} value={supplier.documentCount} label="PDF" /></div>
        <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-xs font-bold text-slate-500"><p className="flex justify-between gap-3"><span>Fiches incomplètes</span><strong className="text-slate-900">{supplier.incompleteCount}</strong></p><p className="flex justify-between gap-3"><span>Délai moyen</span><strong className="text-slate-900">{supplier.averageLeadTime}</strong></p><p className="flex justify-between gap-3"><span>Dernière mise à jour</span><strong className="text-slate-900">{supplier.lastUpdate}</strong></p></div>
        <Link href={`/admin/catalogue?fournisseur=${encodeURIComponent(supplier.name)}`} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-xs font-black text-slate-700 transition hover:border-[#007f8f] hover:text-[#007f8f]">Voir les produits <ChevronRight size={15} /></Link>
      </article>)}
    </section>
  </>;
}

function Metric({ icon: Icon, value, label }: { icon: typeof Package; value: number; label: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><Icon size={15} className="text-[#007f8f]" /><p className="mt-2 text-lg font-black">{value}</p><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</p></div>;
}
