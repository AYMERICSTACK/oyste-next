"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  FileText,
  GitCompareArrows,
  Grid2X2,
  Heart,
  LayoutList,
  PackageCheck,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import ProductMediaFrame from "./ProductMediaFrame";

export type PremiumCatalogItem = {
  id: string;
  code: string;
  name: string;
  family: string;
  description: string;
  href: string;
  imageUrl: string;
  priceLabel: string;
  minPriceHT: number | null;
  badge: string;
  documentCount: number;
  variantCount: number;
  experienceType: "STANDARD" | "CONFIGURABLE";
  stock: number | null;
  delay: string;
};

type ViewMode = "grid" | "list";
type SortMode = "recommended" | "price-asc" | "price-desc" | "name" | "variants";

const PAGE_SIZE = 18;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-black transition ${
        active
          ? "border-[#007f8f] bg-[#007f8f] text-white"
          : "border-slate-200 bg-white text-slate-700 hover:border-[#007f8f]/50"
      }`}
    >
      {active ? <Check size={15} /> : null}
      {children}
    </button>
  );
}

export default function PremiumCatalog({ products }: { products: PremiumCatalogItem[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("recommended");
  const [view, setView] = useState<ViewMode>("grid");
  const [showFilters, setShowFilters] = useState(false);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [onlyConfigurable, setOnlyConfigurable] = useState(false);
  const [onlyDocuments, setOnlyDocuments] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("oyste-favorites") || "[]"); } catch { return []; }
  });
  const [compare, setCompare] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("oyste-compare") || "[]"); } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem("oyste-favorites", JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem("oyste-compare", JSON.stringify(compare));
  }, [compare]);


  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    const result = products.filter((product) => {
      if (term && !normalize(`${product.name} ${product.code} ${product.family} ${product.description}`).includes(term)) return false;
      if (onlyAvailable && !(product.stock === null || product.stock > 0)) return false;
      if (onlyConfigurable && product.experienceType !== "CONFIGURABLE") return false;
      if (onlyDocuments && product.documentCount < 1) return false;
      return true;
    });

    return [...result].sort((a, b) => {
      if (sort === "price-asc") return (a.minPriceHT ?? Number.MAX_SAFE_INTEGER) - (b.minPriceHT ?? Number.MAX_SAFE_INTEGER);
      if (sort === "price-desc") return (b.minPriceHT ?? -1) - (a.minPriceHT ?? -1);
      if (sort === "name") return a.name.localeCompare(b.name, "fr");
      if (sort === "variants") return b.variantCount - a.variantCount;
      return 0;
    });
  }, [products, query, sort, onlyAvailable, onlyConfigurable, onlyDocuments]);

  const visible = filtered.slice(0, visibleCount);
  const comparedProducts = compare.map((id) => products.find((product) => product.id === id)).filter(Boolean) as PremiumCatalogItem[];
  const activeFilterCount = [onlyAvailable, onlyConfigurable, onlyDocuments].filter(Boolean).length;

  function toggleFavorite(id: string) {
    setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleCompare(id: string) {
    setCompare((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 3) return [...current.slice(1), id];
      return [...current, id];
    });
  }

  function resetFilters() {
    setQuery("");
    setOnlyAvailable(false);
    setOnlyConfigurable(false);
    setOnlyDocuments(false);
    setSort("recommended");
  }

  return (
    <div>
      <div className="sticky top-20 z-30 rounded-[2rem] border border-slate-200 bg-white/95 p-4 shadow-xl shadow-slate-950/5 backdrop-blur-xl md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <label className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              value={query}
              onChange={(event) => { setQuery(event.target.value); setVisibleCount(PAGE_SIZE); }}
              placeholder="Rechercher dans cette famille, une référence…"
              className="h-13 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-11 text-sm font-bold text-slate-950 outline-none transition focus:border-[#007f8f] focus:bg-white focus:ring-4 focus:ring-[#007f8f]/10"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-950" aria-label="Effacer la recherche">
                <X size={18} />
              </button>
            ) : null}
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilters((value) => !value)}
              className={`inline-flex h-12 items-center gap-2 rounded-2xl border px-4 text-sm font-black transition ${showFilters || activeFilterCount ? "border-[#007f8f] bg-[#007f8f]/10 text-[#005466]" : "border-slate-200 bg-white text-slate-700"}`}
            >
              <SlidersHorizontal size={18} /> Filtres
              {activeFilterCount ? <span className="rounded-full bg-[#007f8f] px-2 py-0.5 text-[11px] text-white">{activeFilterCount}</span> : null}
            </button>

            <label className="relative">
              <select
                value={sort}
                onChange={(event) => { setSort(event.target.value as SortMode); setVisibleCount(PAGE_SIZE); }}
                className="h-12 appearance-none rounded-2xl border border-slate-200 bg-white pl-4 pr-10 text-sm font-black text-slate-700 outline-none focus:border-[#007f8f]"
              >
                <option value="recommended">Tri recommandé</option>
                <option value="price-asc">Prix croissant</option>
                <option value="price-desc">Prix décroissant</option>
                <option value="name">Nom A–Z</option>
                <option value="variants">Plus de variantes</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} />
            </label>

            <div className="flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
              <button type="button" onClick={() => setView("grid")} className={`rounded-xl p-2.5 ${view === "grid" ? "bg-white text-[#007f8f] shadow-sm" : "text-slate-400"}`} aria-label="Vue grille"><Grid2X2 size={19} /></button>
              <button type="button" onClick={() => setView("list")} className={`rounded-xl p-2.5 ${view === "list" ? "bg-white text-[#007f8f] shadow-sm" : "text-slate-400"}`} aria-label="Vue liste"><LayoutList size={20} /></button>
            </div>
          </div>
        </div>

        {showFilters ? (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <Toggle active={onlyAvailable} onClick={() => { setOnlyAvailable((value) => !value); setVisibleCount(PAGE_SIZE); }}><PackageCheck size={16} /> Disponible</Toggle>
              <Toggle active={onlyConfigurable} onClick={() => { setOnlyConfigurable((value) => !value); setVisibleCount(PAGE_SIZE); }}><Sparkles size={16} /> Sur mesure</Toggle>
              <Toggle active={onlyDocuments} onClick={() => { setOnlyDocuments((value) => !value); setVisibleCount(PAGE_SIZE); }}><FileText size={16} /> Documentation PDF</Toggle>
              {activeFilterCount || query ? (
                <button type="button" onClick={resetFilters} className="ml-auto text-sm font-black text-orange-600 hover:text-orange-700">Réinitialiser</button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-bold text-slate-600">
          <span className="text-lg font-black text-slate-950">{filtered.length}</span> produit{filtered.length > 1 ? "s" : ""} trouvé{filtered.length > 1 ? "s" : ""}
        </p>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Catalogue professionnel OYSTE</p>
      </div>

      {visible.length ? (
        <div className={view === "grid" ? "mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3" : "mt-6 grid gap-4"}>
          {visible.map((product) => {
            const favorite = favorites.includes(product.id);
            const compared = compare.includes(product.id);
            return (
              <article key={product.id} className={`group relative overflow-hidden rounded-[2rem] border bg-white shadow-sm transition hover:border-orange-400 hover:shadow-xl ${view === "list" ? "grid md:grid-cols-[280px_1fr]" : "border-slate-200"}`}>
                <div className="relative">
                  <Link href={product.href} className="block">
                    <ProductMediaFrame src={product.imageUrl} alt={product.name} label={product.badge} documentCount={product.documentCount} variant="card" interactive />
                  </Link>
                  <div className="absolute right-4 top-4 z-10 flex gap-2">
                    <button type="button" onClick={() => toggleFavorite(product.id)} className={`grid h-10 w-10 place-items-center rounded-full border bg-white/95 shadow-sm transition ${favorite ? "border-orange-300 text-orange-600" : "border-white text-slate-500 hover:text-orange-600"}`} aria-label="Ajouter aux favoris">
                      <Heart size={18} fill={favorite ? "currentColor" : "none"} />
                    </button>
                    <button type="button" onClick={() => toggleCompare(product.id)} className={`grid h-10 w-10 place-items-center rounded-full border bg-white/95 shadow-sm transition ${compared ? "border-[#007f8f] text-[#007f8f]" : "border-white text-slate-500 hover:text-[#007f8f]"}`} aria-label="Comparer ce produit">
                      <GitCompareArrows size={18} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">{product.family}</p>
                      <p className="mt-2 text-xs font-bold text-slate-400">Réf. {product.code}</p>
                    </div>
                    {product.variantCount > 1 ? <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-600">{product.variantCount} variantes</span> : null}
                  </div>
                  <Link href={product.href} className="mt-4 block">
                    <h3 className="line-clamp-2 text-xl font-black leading-tight text-slate-950 transition group-hover:text-[#007f8f]">{product.name}</h3>
                  </Link>
                  <p className={`mt-3 text-sm leading-6 text-slate-600 ${view === "grid" ? "line-clamp-3 min-h-[4.5rem]" : "line-clamp-2"}`}>{product.description}</p>

                  <div className="mt-auto pt-5">
                    <div className="flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-5">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Prix professionnel</p>
                        <p className="mt-1 text-xl font-black text-slate-950">{product.priceLabel}</p>
                      </div>
                      <Link href={product.href} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-[#007f8f]">
                        Voir la fiche <ArrowRight size={17} />
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 rounded-[2rem] border border-dashed border-slate-300 bg-white p-12 text-center">
          <Search className="mx-auto text-slate-300" size={42} />
          <h3 className="mt-5 text-xl font-black text-slate-950">Aucun produit ne correspond</h3>
          <p className="mt-2 text-sm text-slate-600">Modifiez votre recherche ou réinitialisez les filtres.</p>
          <button type="button" onClick={resetFilters} className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white">Réinitialiser</button>
        </div>
      )}

      {visibleCount < filtered.length ? (
        <div className="mt-10 text-center">
          <button type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)} className="rounded-2xl border border-slate-200 bg-white px-7 py-4 text-sm font-black text-slate-800 shadow-sm transition hover:border-[#007f8f] hover:text-[#007f8f]">
            Afficher plus de produits ({filtered.length - visibleCount} restants)
          </button>
        </div>
      ) : null}

      {comparedProducts.length ? (
        <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-5xl rounded-[1.75rem] border border-slate-200 bg-slate-950 p-4 text-white shadow-2xl md:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10"><GitCompareArrows size={21} /></div>
              <div className="min-w-0">
                <p className="text-sm font-black">Comparateur OYSTE</p>
                <p className="truncate text-xs text-slate-300">{comparedProducts.map((product) => product.name).join(" · ")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-black">{comparedProducts.length}/3</span>
              <button type="button" onClick={() => setCompare([])} className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-black hover:bg-white/10">Vider</button>
              <button type="button" disabled={comparedProducts.length < 2} className="rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40">Comparer</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
