"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArrowDownUp, CheckSquare, ChevronLeft, ChevronRight, Download, FileText, ImageIcon, MoreHorizontal, PackagePlus, Pencil, Search, SlidersHorizontal, Star, Trash2 } from "lucide-react";
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
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const exportMenuRef = useRef<HTMLDetailsElement>(null);

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * pageSize;
  const paginatedProducts = filtered.slice(pageStart, pageStart + pageSize);
  const displayStart = filtered.length === 0 ? 0 : pageStart + 1;
  const displayEnd = Math.min(pageStart + pageSize, filtered.length);
  const visibleIds = paginatedProducts.map((product) => product.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const toggleVisible = () => setSelected(allVisibleSelected ? selected.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...selected, ...visibleIds])));
  const toggleProduct = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const resetFilters = () => { setQuery(""); setStatus("Tous"); setCategory("Toutes"); setSupplier("Tous"); setStock("Tous"); setCompleteness("Toutes"); setCurrentPage(1); };

  const deleteSelectedProducts = async () => {
    if (!selected.length) return;
    const expected = `SUPPRIMER ${selected.length}`;
    const confirmation = window.prompt(
      `Suppression définitive de ${selected.length} produit(s).\n` +
      `Si un seul produit apparaît dans une commande, toute l’opération sera annulée.\n\n` +
      `Tapez exactement ${expected} pour confirmer.`,
    );
    if (confirmation !== expected) return;

    setBulkDeleting(true);
    setBulkDeleteError("");
    try {
      const response = await fetch("/api/admin/catalogue/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Suppression impossible.");
      window.location.reload();
    } catch (error) {
      setBulkDeleteError(error instanceof Error ? error.message : "Suppression impossible.");
    } finally {
      setBulkDeleting(false);
    }
  };

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (exportMenuRef.current?.open && !exportMenuRef.current.contains(event.target as Node)) exportMenuRef.current.open = false;
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && exportMenuRef.current) exportMenuRef.current.open = false;
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const exportExcel = async (scope: "filtered" | "all") => {
    const XLSX = await import("xlsx");
    const source = scope === "filtered" ? filtered : products;
    const rows: Array<Record<string, string | number | null>> = [];

    source.forEach((product) => {
      rows.push({
        "Type de ligne": "Produit",
        "Référence": product.code,
        "Référence fournisseur": product.supplierCode || "",
        "Référence parente": product.parentCode || "",
        "Désignation": product.name,
        "Nom court": product.shortName || "",
        "Fournisseur": product.manufacturer || "Sans fournisseur",
        "Catégorie": product.categoryPath || "Non classé",
        "Prix HT (€)": product.priceHT ?? null,
        "Prix minimum HT (€)": product.minPriceHT ?? null,
        "Prix maximum HT (€)": product.maxPriceHT ?? null,
        "Stock": product.stock ?? 0,
        "État du stock": (product.stock ?? 0) > 0 ? "En stock" : "Rupture",
        "Délai": product.delay || "",
        "Poids (kg)": product.weightKg ?? null,
        "Longueur colis (cm)": product.packageLengthCm ?? null,
        "Largeur colis (cm)": product.packageWidthCm ?? null,
        "Hauteur colis (cm)": product.packageHeightCm ?? null,
        "Mode d'expédition": product.shippingMode || "",
        "Nombre de variantes": product.variants?.length ?? 0,
        "Nombre d'images": product.images.length,
        "Nombre de documents": product.documentCount,
        "Complétude (%)": product.completeness,
        "Statut": product.status,
        "Slug": product.slug,
        "URL boutique": product.href || "",
      });

      (product.variants ?? []).forEach((variant) => {
        rows.push({
          "Type de ligne": "Variante",
          "Référence": variant.code,
          "Référence fournisseur": variant.supplierCode || "",
          "Référence parente": product.code,
          "Désignation": variant.label || variant.name || product.name,
          "Nom court": product.shortName || "",
          "Fournisseur": product.manufacturer || "Sans fournisseur",
          "Catégorie": product.categoryPath || "Non classé",
          "Prix HT (€)": variant.priceHT ?? null,
          "Prix minimum HT (€)": null,
          "Prix maximum HT (€)": null,
          "Stock": variant.stock ?? 0,
          "État du stock": (variant.stock ?? 0) > 0 ? "En stock" : "Rupture",
          "Délai": variant.delay || product.delay || "",
          "Poids (kg)": variant.weightKg ?? null,
          "Longueur colis (cm)": variant.packageLengthCm ?? product.packageLengthCm ?? null,
          "Largeur colis (cm)": variant.packageWidthCm ?? product.packageWidthCm ?? null,
          "Hauteur colis (cm)": variant.packageHeightCm ?? product.packageHeightCm ?? null,
          "Mode d'expédition": variant.shippingMode || product.shippingMode || "",
          "Nombre de variantes": 0,
          "Nombre d'images": "",
          "Nombre de documents": "",
          "Complétude (%)": "",
          "Statut": product.status,
          "Slug": product.slug,
          "URL boutique": product.href || "",
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const headers = Object.keys(rows[0] ?? {
      "Type de ligne": "",
      "Référence": "",
      "Désignation": "",
      "Fournisseur": "",
      "Catégorie": "",
    });
    worksheet["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(Math.max(headers.length - 1, 0))}${Math.max(rows.length + 1, 1)}` };
    worksheet["!cols"] = headers.map((header) => {
      const maxValueLength = rows.reduce((maximum, row) => Math.max(maximum, String(row[header] ?? "").length), header.length);
      return { wch: Math.min(Math.max(maxValueLength + 2, 12), 42) };
    });
    worksheet["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Produits + variantes");

    const date = new Date().toISOString().slice(0, 10);
    const normalizedSupplier = supplier !== "Tous" ? supplier.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "";
    const suffix = scope === "all" ? "complet" : normalizedSupplier || "filtres";
    XLSX.writeFileXLSX(workbook, `catalogue-oyste-${suffix}-${date}.xlsx`, { compression: true });
  };

  return <>
    <div className="mt-7 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-slate-100 px-4 py-3"><Search size={18} className="text-slate-400" /><input value={query} onChange={(event) => { setQuery(event.target.value); setCurrentPage(1); }} placeholder="Rechercher par produit, référence, fournisseur…" className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-slate-400" /></div>
        <div className="flex flex-wrap gap-2">
          <details ref={exportMenuRef} className="group relative">
            <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-600 transition hover:border-[#007f8f] hover:text-[#007f8f]"><Download size={16} /> Export Excel</summary>
            <div className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              <button onClick={() => { if (exportMenuRef.current) exportMenuRef.current.open = false; void exportExcel("filtered"); }} className="w-full rounded-xl px-3 py-3 text-left transition hover:bg-slate-50">
                <span className="block text-xs font-black text-slate-900">Exporter les résultats filtrés</span>
                <span className="mt-1 block text-[10px] font-bold text-slate-400">{filtered.length} produit{filtered.length > 1 ? "s" : ""} selon les filtres actifs</span>
              </button>
              <button onClick={() => { if (exportMenuRef.current) exportMenuRef.current.open = false; void exportExcel("all"); }} className="w-full rounded-xl px-3 py-3 text-left transition hover:bg-slate-50">
                <span className="block text-xs font-black text-slate-900">Exporter tout le catalogue</span>
                <span className="mt-1 block text-[10px] font-bold text-slate-400">{products.length} produit{products.length > 1 ? "s" : ""} sans appliquer les filtres</span>
              </button>
            </div>
          </details>
          <Link href="/admin/catalogue/nouveau" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#007f8f] px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-cyan-900/10"><PackagePlus size={17} /> Nouveau produit</Link>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        <FilterSelect label="Catégorie" icon={<SlidersHorizontal size={15} />} value={category} onChange={(value) => { setCategory(value); setCurrentPage(1); }} options={["Toutes", ...categories]} />
        <FilterSelect label="Fournisseur" value={supplier} onChange={(value) => { setSupplier(value); setCurrentPage(1); }} options={["Tous", ...suppliers]} />
        <FilterSelect label="Statut" value={status} onChange={(value) => { setStatus(value); setCurrentPage(1); }} options={["Tous", "Publié", "Brouillon", "Masqué"]} />
        <FilterSelect label="Stock" value={stock} onChange={(value) => { setStock(value); setCurrentPage(1); }} options={["Tous", "En stock", "Rupture"]} />
        <FilterSelect label="Complétude" value={completeness} onChange={(value) => { setCompleteness(value); setCurrentPage(1); }} options={["Toutes", "Complètes", "À compléter"]} />
        <button onClick={resetFilters} className="min-h-[62px] rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-black text-slate-500 hover:bg-slate-50">Réinitialiser</button>
      </div>
      <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-black text-slate-700">{filtered.length} produit{filtered.length > 1 ? "s" : ""}</p>
          <p className="mt-1 text-[11px] font-bold text-slate-400">Affichage de {displayStart} à {displayEnd} sur {filtered.length}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-600">Afficher<select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setCurrentPage(1); }} className="bg-transparent outline-none"><option value={20}>20</option><option value={30}>30</option><option value={40}>40</option><option value={50}>50</option></select></label>
          <div className="flex items-center gap-2"><ArrowDownUp size={15} className="text-slate-400" /><select value={sortBy} onChange={(event) => { setSortBy(event.target.value as SortKey); setCurrentPage(1); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black outline-none"><option value="name">Nom</option><option value="manufacturer">Fournisseur</option><option value="price">Prix</option><option value="stock">Stock</option><option value="completeness">Complétude</option></select><button onClick={() => { setSortDirection((value) => value === "asc" ? "desc" : "asc"); setCurrentPage(1); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black">{sortDirection === "asc" ? "Croissant" : "Décroissant"}</button></div>
        </div>
      </div>
    </div>

    {selected.length > 0 && (
      <div className="sticky top-3 z-20 mt-4 rounded-2xl bg-slate-950 px-5 py-4 text-white shadow-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CheckSquare size={18} className="text-cyan-300" />
            <p className="text-sm font-black">{selected.length} produit{selected.length > 1 ? "s" : ""} sélectionné{selected.length > 1 ? "s" : ""}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <BulkButton label="Publier" />
            <BulkButton label="Masquer" />
            <BulkButton label="Changer fournisseur" />
            <BulkButton label="Changer catégorie" />
            <button
              type="button"
              onClick={() => void deleteSelectedProducts()}
              disabled={bulkDeleting}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-[10px] font-black text-white hover:bg-red-500 disabled:opacity-50"
            >
              <Trash2 size={13} /> {bulkDeleting ? "Suppression…" : "Supprimer"}
            </button>
            <button onClick={() => { setSelected([]); setBulkDeleteError(""); }} className="rounded-lg border border-white/15 px-3 py-2 text-[10px] font-black">Annuler</button>
          </div>
        </div>
        {bulkDeleteError ? (
          <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-100">
            {bulkDeleteError}
          </div>
        ) : null}
      </div>
    )}

    <section className="mt-5 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-black">Produits</h2><p className="mt-1 text-xs text-slate-400">Affichage de {displayStart} à {displayEnd} sur {filtered.length} produit{filtered.length > 1 ? "s" : ""}</p></div><div className="flex items-center gap-2"><PaginationControls currentPage={safeCurrentPage} totalPages={totalPages} onPageChange={setCurrentPage} compact /><button className="rounded-xl border border-slate-200 p-2 text-slate-500"><MoreHorizontal size={18} /></button></div></div>
      <div className="overflow-x-auto">
        <table className="min-w-[1220px] w-full text-left">
          <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400"><tr><th className="px-4 py-3"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} className="h-4 w-4 accent-[#007f8f]" /></th><th className="px-4 py-3">Produit</th><th className="px-4 py-3">Fournisseur</th><th className="px-4 py-3">Catégorie</th><th className="px-4 py-3">Prix / stock</th><th className="px-4 py-3">Médias</th><th className="px-4 py-3">Complétude</th><th className="px-4 py-3">Statut</th><th className="px-5 py-3 text-right">Action</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{paginatedProducts.map((product, index) => <tr key={product.id} className={`group hover:bg-slate-50/70 ${selected.includes(product.id) ? "bg-cyan-50/40" : ""}`}>
            <td className="px-4 py-4"><input type="checkbox" checked={selected.includes(product.id)} onChange={() => toggleProduct(product.id)} className="h-4 w-4 accent-[#007f8f]" /></td>
            <td className="px-4 py-4"><div className="flex items-center gap-3"><button title="Épingler" className="text-slate-250 hover:text-amber-500"><Star size={15} /></button><div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">{product.images[0] ? <img src={product.images[0]} alt="" className="h-full w-full object-contain p-1" /> : <ImageIcon size={20} className="text-slate-300" />}</div><div className="min-w-0"><p className="max-w-[300px] truncate text-sm font-black text-slate-900">{product.name}</p><p className="mt-1 text-[11px] font-bold text-slate-400">{product.code}</p><p className="mt-1 text-[9px] font-bold text-slate-300">Modifié le {String(((pageStart + index) % 17) + 1).padStart(2, "0")}/07/2026 par Aymeric D.</p></div></div></td>
            <td className="px-4 py-4"><button onClick={() => { setSupplier(product.manufacturer || "Sans fournisseur"); setCurrentPage(1); }} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-black text-slate-700 hover:bg-cyan-50 hover:text-[#007f8f]">{product.manufacturer || "Sans fournisseur"}</button></td>
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
      {filtered.length > 0 && <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs font-bold text-slate-400">Affichage de {displayStart} à {displayEnd} sur {filtered.length}</p><PaginationControls currentPage={safeCurrentPage} totalPages={totalPages} onPageChange={setCurrentPage} /></div>}
    </section>
  </>;
}

function FilterSelect({ label, value, onChange, options, icon }: { label: string; value: string; onChange: (value: string) => void; options: string[]; icon?: React.ReactNode }) {
  return <label className="rounded-xl border border-slate-200 px-3 py-2 text-slate-600 transition focus-within:border-[#007f8f] focus-within:ring-2 focus-within:ring-cyan-100"><span className="block text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</span><span className="mt-1 flex items-center gap-2 text-xs font-black">{icon}<select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent outline-none">{options.map((option) => <option key={option}>{option}</option>)}</select></span></label>;
}

function PaginationControls({ currentPage, totalPages, onPageChange, compact = false }: { currentPage: number; totalPages: number; onPageChange: (page: number) => void; compact?: boolean }) {
  return <div className="flex items-center gap-2">
    <button type="button" onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-black text-slate-600 transition hover:border-[#007f8f] hover:text-[#007f8f] disabled:cursor-not-allowed disabled:opacity-35"><ChevronLeft size={14} />{compact ? "" : "Précédent"}</button>
    <span className="min-w-[92px] text-center text-[10px] font-black text-slate-500">Page {currentPage} / {totalPages}</span>
    <button type="button" onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-black text-slate-600 transition hover:border-[#007f8f] hover:text-[#007f8f] disabled:cursor-not-allowed disabled:opacity-35">{compact ? "" : "Suivant"}<ChevronRight size={14} /></button>
  </div>;
}

function BulkButton({ label }: { label: string }) {
  return <button className="rounded-lg bg-white px-3 py-2 text-[10px] font-black text-slate-950">{label}</button>;
}
