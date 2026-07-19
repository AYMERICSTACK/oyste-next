"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2, PackageSearch, Search, X } from "lucide-react";

interface SearchResult {
  id: string;
  name: string;
  code: string;
  category: string;
  href: string;
  image: string;
  price: string;
  configurable: boolean;
}

interface CategoryResult {
  title: string;
  href: string;
  count: number;
}

export default function SearchBar({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [categories, setCategories] = useState<CategoryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    const onEscape = (event: globalThis.KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onEscape);
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onEscape);
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/catalogue/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        setResults(data.products || []);
        setCategories(data.categories || []);
        setActiveIndex(-1);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setResults([]);
          setCategories([]);
        }
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const target = results[activeIndex] || results[0];
    if (target) window.location.href = target.href;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((value) => Math.min(value + 1, results.length - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((value) => Math.max(value - 1, -1));
    }
  }

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Rechercher dans le catalogue"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-950 transition hover:border-[#007f8f] hover:text-[#007f8f]"
        >
          <Search size={19} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-[#007f8f] hover:shadow-md"
        >
          <Search size={20} className="text-[#007f8f]" />
          <span className="flex-1 text-sm font-semibold text-slate-400">Produit, référence, catégorie...</span>
          <span className="hidden rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500 sm:inline">RECHERCHER</span>
        </button>
      )}

      {open ? (
        <div className="fixed inset-0 z-[100] bg-slate-950/65 p-3 backdrop-blur-sm sm:p-6" onMouseDown={() => setOpen(false)}>
          <div
            className="mx-auto mt-3 max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-hidden rounded-[2rem] bg-white shadow-2xl sm:mt-12"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <form onSubmit={submit} className="flex items-center gap-3 border-b border-slate-200 p-4 sm:p-6">
              {loading ? <Loader2 className="animate-spin text-[#007f8f]" size={24} /> : <Search className="text-[#007f8f]" size={24} />}
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  const value = event.target.value;
                  setQuery(value);
                  if (value.trim().length < 2) setLoading(false);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Rechercher un palan, une référence, une potence..."
                className="min-w-0 flex-1 bg-transparent text-base font-bold text-slate-950 outline-none placeholder:font-semibold placeholder:text-slate-400 sm:text-xl"
              />
              {query ? (
                <button type="button" onClick={() => setQuery("")} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Effacer">
                  <X size={20} />
                </button>
              ) : null}
              <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-slate-100 p-2.5 text-slate-700 hover:bg-slate-200" aria-label="Fermer">
                <X size={20} />
              </button>
            </form>

            <div className="max-h-[calc(100vh-8rem)] overflow-y-auto p-4 sm:p-6">
              {query.trim().length < 2 ? (
                <div className="py-10 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#007f8f]/10 text-[#007f8f]">
                    <PackageSearch size={30} />
                  </div>
                  <h2 className="mt-5 text-xl font-black text-slate-950">Que recherchez-vous ?</h2>
                  <p className="mt-2 text-sm text-slate-500">Saisissez au moins deux caractères. La recherche analyse les noms, références, variantes et catégories.</p>
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {["Palan", "Potence", "Gerbeur", "Transpalette", "SEW"].map((term) => (
                      <button key={term} type="button" onClick={() => setQuery(term)} className="rounded-full border border-slate-200 px-4 py-2 text-xs font-black text-slate-700 hover:border-[#007f8f] hover:text-[#007f8f]">
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              ) : !loading && results.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-lg font-black text-slate-950">Aucun résultat pour « {query} »</p>
                  <p className="mt-2 text-sm text-slate-500">Essayez une référence plus courte ou le nom de la famille produit.</p>
                </div>
              ) : (
                <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
                  <div>
                    <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-slate-500">Produits</p>
                    <div className="space-y-2">
                      {results.map((result, index) => (
                        <a
                          key={result.id}
                          href={result.href}
                          className={`flex items-center gap-4 rounded-2xl border p-3 transition ${activeIndex === index ? "border-[#007f8f] bg-[#007f8f]/5" : "border-slate-200 hover:border-[#007f8f] hover:bg-slate-50"}`}
                        >
                          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={result.image} alt="" className="h-full w-full object-contain p-2" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-black uppercase tracking-[0.12em] text-orange-600">{result.code}</span>
                              {result.configurable ? <span className="rounded-full bg-[#007f8f]/10 px-2 py-1 text-[9px] font-black uppercase text-[#006b78]">Sur mesure</span> : null}
                            </div>
                            <h3 className="mt-1 line-clamp-2 font-black text-slate-950">{result.name}</h3>
                            <p className="mt-1 text-xs font-semibold text-slate-500">{result.category}</p>
                          </div>
                          <div className="hidden text-right sm:block">
                            <p className="text-sm font-black text-slate-950">{result.price}</p>
                            <ArrowRight className="ml-auto mt-2 text-[#007f8f]" size={18} />
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>

                  <aside>
                    <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-slate-500">Univers</p>
                    <div className="space-y-2">
                      {categories.map((category) => (
                        <a key={category.href} href={category.href} className="flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-800 hover:bg-[#007f8f] hover:text-white">
                          <span>{category.title}</span>
                          <span className="text-xs opacity-70">{category.count}</span>
                        </a>
                      ))}
                    </div>
                  </aside>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
