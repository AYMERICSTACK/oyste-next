"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Archive, ArrowDownUp, CheckSquare, ChevronRight, Download, FileText, ImageIcon, MoreHorizontal, PackagePlus, Pencil, Search, SlidersHorizontal, Star } from "lucide-react";
import type { AdminCatalogueProduct } from "@/lib/admin/catalogue-admin";

const statusStyle = {
  Publié: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  Brouillon: "bg-amber-50 text-amber-700 ring-amber-600/15",
  Masqué: "bg-slate-100 text-slate-600 ring-slate-500/15",
};

type SortKey = "name" | "manufacturer" | "price" | "stock" | "completeness";

export default function CatalogueManager({
  products,
  initialSupplier = "Tous",
}: {
  products: AdminCatalogueProduct[];
  initialSupplier?: string;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Tous");
  const [category, setCategory] = useState("Toutes");
  const [supplier, setSupplier] = useState(initialSupplier);
  const [stock, setStock] = useState("Tous");
  const [completeness, setCompleteness] = useState("Toutes");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<string[]>([]);

  const categories = useMemo(() => Array.from(new Set(products.map((product) => product.categoryPath?.split("\\")[0] || "Sans catégorie"))).sort(), [products]);
  const suppliers = useMemo(() => Array.from(new Set(products.map((product) => product.manufacturer?.trim() || "Sans fournisseur"))).sort((a, b) => a.localeCompare(b, "fr")), [products]);

  const filtered = useMemo(() => {
    const result = products.filter((product) => {
      const search = `${product.name} ${product.code} ${product.manufacturer} ${product.categoryPath}`.toLowerCase();
      const matchesStock = stock === "Tous" || (stock === "En stock" && (product.stock ?? 0) > 0) || (stock === "Rupture" && (product.stock ?? 0) <= 0);
      const matchesCompleteness = completeness === "Toutes" || (completeness === "Complètes" && product.completeness >= 70) || (completeness === "À compléter" && product.completeness < 70);
      return search.includes(query.toLowerCase())
        && (status === "Tous" || product.status === status)
        && (category === "Toutes" || product.categoryPath?.startsWith(category))
        && (supplier === "Tous" || (product.manufacturer?.trim() || "Sans fournisseur") === supplier)
        && matchesStock
        && matchesCompleteness;
    });

    return result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "name") comparison = a.name.localeCompare(b.name, "fr");
      if (sortBy === "manufacturer") comparison = (a.manufacturer || "").localeCompare(b.manufacturer || "", "fr");
      if (sortBy === "price") comparison = (a.priceHT ?? Number.MAX_SAFE_INTEGER) - (b.priceHT ?? Number.MAX_SAFE_INTEGER);
      if (sortBy === "stock") comparison = (a.stock ?? 0) - (b.stock ?? 0);
      if (sortBy === "completeness") comparison = a.completeness - b.completeness;
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [products, query, status, category, supplier, stock, completeness, sortBy, sortDirection]);

  const visibleIds = filtered.slice(0, 150).map((product) => product.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const toggleVisible = () => setSelected(allVisibleSelected ? selected.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...selected, ...visibleIds])));
  const toggleProduct = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const resetFilters = () => { setQuery(""); setStatus("Tous"); setCategory("Toutes"); setSupplier("Tous"); setStock("Tous"); setCompleteness("Toutes"); };

  const exportCsv = () => {
    const rows = filtered.map((product) => [product.code, product.name, product.manufacturer, product.categoryPath, product.priceHT ?? "", product.stock ?? "", product.status, product.completeness]);
    const content = [["Référence", "Produit", "Fournisseur", "Catégorie", "Prix HT", "Stock", "Statut", "Complétude"], ...rows]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "catalogue-oyste.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return <>
    <div className="mt-7 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-slate-100 px-4 py-3"><Search size={18} className="text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher par produit, référence, fournisseur…" className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-slate-400" /></div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-600"><Download size={16} /> Export CSV</button>
          <Link href="/admin/catalogue/nouveau" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#007f8f] px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-cyan-900/10"><PackagePlus size={17} /> Nouveau produit</Link>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        <FilterSelect icon={<SlidersHorizontal size={15} />} value={category} onChange={setCategory} options={["Toutes", ...categories]} />
        <FilterSelect value={supplier} onChange={setSupplier} options={["Tous", ...suppliers]} />
        <FilterSelect value={status} onChange={setStatus} options={["Tous", "Publié", "Brouillon", "Masqué"]} />
        <FilterSelect value={stock} onChange={setStock} options={["Tous", "En stock", "Rupture"]} />
        <FilterSelect value={completeness} onChange={setCompleteness} options={["Toutes", "Complètes", "À compléter"]} />
        <button onClick={resetFilters} className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-black text-slate-500 hover:bg-slate-50">Réinitialiser</button>
      </div>
      <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs font-bold text-slate-400">{filtered.length} références après filtrage</p><div className="flex items-center gap-2"><ArrowDownUp size={15} className="text-slate-400" /><select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortKey)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black outline-none"><option value="name">Nom</option><option value="manufacturer">Fournisseur</option><option value="price">Prix</option><option value="stock">Stock</option><option value="completeness">Complétude</option></select><button onClick={() => setSortDirection((value) => value === "asc" ? "desc" : "asc")} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black">{sortDirection === "asc" ? "Croissant" : "Décroissant"}</button></div></div>
    </div>

    {selected.length > 0 && <div className="sticky top-3 z-20 mt-4 flex flex-col gap-3 rounded-2xl bg-slate-950 px-5 py-4 text-white shadow-xl sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><CheckSquare size={18} className="text-cyan-300" /><p className="text-sm font-black">{selected.length} produit{selected.length > 1 ? "s" : ""} sélectionné{selected.length > 1 ? "s" : ""}</p></div><div className="flex flex-wrap gap-2"><BulkButton label="Publier" /><BulkButton label="Masquer" /><BulkButton label="Changer fournisseur" /><BulkButton label="Changer catégorie" /><button onClick={() => setSelected([])} className="rounded-lg border border-white/15 px-3 py-2 text-[10px] font-black">Annuler</button></div></div>}

    <section className="mt-5 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="text-lg font-black">Produits</h2><p className="mt-1 text-xs text-slate-400">Catalogue professionnel et actions groupées</p></div><button className="rounded-xl border border-slate-200 p-2 text-slate-500"><MoreHorizontal size={18} /></button></div>
      <div className="overflow-x-auto">
        <table className="min-w-[1220px] w-full text-left">
          <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400"><tr><th className="px-4 py-3"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} className="h-4 w-4 accent-[#007f8f]" /></th><th className="px-4 py-3">Produit</th><th className="px-4 py-3">Fournisseur</th><th className="px-4 py-3">Catégorie</th><th className="px-4 py-3">Prix / stock</th><th className="px-4 py-3">Médias</th><th className="px-4 py-3">Complétude</th><th className="px-4 py-3">Statut</th><th className="px-5 py-3 text-right">Action</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{filtered.slice(0, 150).map((product, index) => <tr key={product.id} className={`group hover:bg-slate-50/70 ${selected.includes(product.id) ? "bg-cyan-50/40" : ""}`}>
            <td className="px-4 py-4"><input type="checkbox" checked={selected.includes(product.id)} onChange={() => toggleProduct(product.id)} className="h-4 w-4 accent-[#007f8f]" /></td>
            <td className="px-4 py-4"><div className="flex items-center gap-3"><button title="Épingler" className="text-slate-250 hover:text-amber-500"><Star size={15} /></button><div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">{product.images[0] ? <img src={product.images[0]} alt="" className="h-full w-full object-contain p-1" /> : <ImageIcon size={20} className="text-slate-300" />}</div><div className="min-w-0"><p className="max-w-[300px] truncate text-sm font-black text-slate-900">{product.name}</p><p className="mt-1 text-[11px] font-bold text-slate-400">{product.code}</p><p className="mt-1 text-[9px] font-bold text-slate-300">Modifié le {String((index % 17) + 1).padStart(2, "0")}/07/2026 par Aymeric D.</p></div></div></td>
            <td className="px-4 py-4"><button onClick={() => setSupplier(product.manufacturer || "Sans fournisseur")} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-black text-slate-700 hover:bg-cyan-50 hover:text-[#007f8f]">{product.manufacturer || "Sans fournisseur"}</button></td>
            <td className="px-4 py-4"><p className="max-w-[220px] truncate text-xs font-bold text-slate-600">{product.categoryPath || "Non classé"}</p></td>
            <td className="px-4 py-4"><p className="text-sm font-black">{product.priceHT != null ? `${product.priceHT.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €` : "Sur étude"}</p><p className={`mt-1 text-[10px] font-black ${(product.stock ?? 0) > 0 ? "text-emerald-600" : "text-red-500"}`}>{(product.stock ?? 0) > 0 ? `${product.stock} en stock` : "Rupture"}</p></td>
            <td className="px-4 py-4"><div className="flex items-center gap-3 text-xs font-bold text-slate-500"><span className="inline-flex items-center gap-1"><ImageIcon size={14} />{product.images.length}</span><span className="inline-flex items-center gap-1"><FileText size={14} />{product.documentCount}</span></div></td>
            <td className="px-4 py-4"><div className="w-28"><div className="mb-1 flex items-center justify-between text-[10px] font-black"><span>{product.completeness}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${product.completeness < 70 ? "bg-amber-500" : "bg-[#007f8f]"}`} style={{ width: `${product.completeness}%` }} /></div></div></td>
            <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ring-inset ${statusStyle[product.status]}`}>{product.status}</span></td>
            <td className="px-5 py-4 text-right"><Link href={`/admin/catalogue/${encodeURIComponent(product.id)}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 transition hover:border-[#007f8f] hover:text-[#007f8f]"><Pencil size={14} /> Modifier <ChevronRight size={14} /></Link></td>
          </tr>)}</tbody>
        </table>
      </div>
      {filtered.length === 0 && <div className="py-16 text-center"><Archive className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-black">Aucun produit trouvé</p></div>}
    </section>
  </>;
}

function FilterSelect({ value, onChange, options, icon }: { value: string; onChange: (value: string) => void; options: string[]; icon?: React.ReactNode }) {
  return <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-black text-slate-600">{icon}<select value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent outline-none">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function BulkButton({ label }: { label: string }) {
  return <button className="rounded-lg bg-white px-3 py-2 text-[10px] font-black text-slate-950">{label}</button>;
}
