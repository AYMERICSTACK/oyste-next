"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Box,
  Building2,
  FileText,
  Factory,
  LoaderCircle,
  PackageCheck,
  Search,
  Settings,
  ShoppingCart,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SearchResult = {
  id: string;
  type: "product" | "order" | "customer" | "production" | "shipment" | "cms" | "user" | "setting";
  title: string;
  subtitle?: string;
  href: string;
  keywords?: string;
};

type SearchGroups = Record<string, SearchResult[]>;

const GROUPS = [
  ["products", "Produits", Box],
  ["orders", "Commandes", ShoppingCart],
  ["customers", "Clients", Building2],
  ["production", "Production", Factory],
  ["shipments", "Expéditions", PackageCheck],
  ["cms", "CMS", FileText],
  ["users", "Utilisateurs", UserRound],
  ["settings", "Paramètres", Settings],
] as const;

function Highlight({ text, query }: { text: string; query: string }) {
  const index = text.toLocaleLowerCase("fr").indexOf(query.toLocaleLowerCase("fr"));
  if (!query || index < 0) return text;
  return <>{text.slice(0, index)}<mark className="rounded bg-orange-100 px-0.5 text-inherit">{text.slice(index, index + query.length)}</mark>{text.slice(index + query.length)}</>;
}

export default function AdminGlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroups>({});
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => GROUPS.flatMap(([key]) => groups[key] ?? []), [groups]);
  const hasResults = results.length > 0;

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(0);
  }, []);


  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (open && panelRef.current && !panelRef.current.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  useEffect(() => {
    if (query.trim().length < 2) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Recherche indisponible");
        const data = await response.json();
        setGroups(data.groups ?? {});
        setActiveIndex(0);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setGroups({});
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 280);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && results.length) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    }
    if (event.key === "ArrowUp" && results.length) {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    }
    if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      router.push(results[activeIndex].href);
      close();
    }
  };


  return (
    <div ref={panelRef} className="relative w-full md:w-[390px]">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-xl bg-slate-100 px-4 py-2.5 text-left transition hover:bg-slate-200/70"
        aria-label="Ouvrir la recherche universelle"
      >
        <Search size={18} className="text-slate-400" />
        <span className="min-w-0 flex-1 truncate text-sm text-slate-400">Commande, client, référence produit…</span>
        <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-400">Ctrl K</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 bg-slate-950/35 p-3 backdrop-blur-[2px] md:absolute md:inset-auto md:left-0 md:top-[calc(100%+12px)] md:w-[620px] md:bg-transparent md:p-0 md:backdrop-blur-none">
          <section className="mx-auto mt-[8vh] max-h-[78vh] w-full max-w-[620px] overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-2xl md:mt-0">
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
              {loading ? <LoaderCircle size={19} className="animate-spin text-[#007f8f]" /> : <Search size={19} className="text-slate-400" />}
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  const value = event.target.value;
                  setQuery(value);
                  if (value.trim().length < 2) {
                    setGroups({});
                    setLoading(false);
                    setActiveIndex(0);
                  }
                }}
                onKeyDown={onInputKeyDown}
                placeholder="Rechercher partout dans OYSTE…"
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
                autoComplete="off"
              />
              {query ? <button type="button" onClick={() => setQuery("")} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={16} /></button> : null}
              <kbd className="hidden rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-400 sm:block">Échap</kbd>
            </div>

            <div className="max-h-[62vh] overflow-y-auto p-2">
              {query.trim().length < 2 ? (
                <div className="px-5 py-12 text-center"><Search className="mx-auto text-slate-200" size={34} /><p className="mt-4 text-sm font-black text-slate-700">Recherche universelle</p><p className="mt-1 text-xs text-slate-400">Saisissez au moins 2 caractères pour rechercher dans tout le back-office.</p></div>
              ) : null}

              {!loading && query.trim().length >= 2 && !hasResults ? (
                <div className="px-5 py-12 text-center"><p className="text-sm font-black text-slate-700">Aucun résultat pour « {query} »</p><p className="mt-1 text-xs text-slate-400">Essayez une référence, une société, un email ou un nom de produit.</p></div>
              ) : null}

              {GROUPS.map(([key, label, Icon]) => {
                const items = groups[key] ?? [];
                if (!items.length) return null;
                return (
                  <div key={key} className="mb-2 last:mb-0">
                    <div className="flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400"><Icon size={13} />{label}<span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[9px]">{items.length}</span></div>
                    <div className="space-y-1">
                      {items.map((item) => {
                        const itemIndex = results.findIndex((result) => result.type === item.type && result.id === item.id);
                        return (
                          <Link
                            key={`${item.type}-${item.id}`}
                            href={item.href}
                            onMouseEnter={() => setActiveIndex(itemIndex)}
                            className={`flex items-center gap-3 rounded-xl px-3 py-3 transition ${activeIndex === itemIndex ? "bg-slate-950 text-white" : "hover:bg-slate-50"}`}
                          >
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${activeIndex === itemIndex ? "bg-white/10 text-white" : "bg-slate-100 text-[#007f8f]"}`}><Icon size={17} /></span>
                            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-black"><Highlight text={item.title} query={query.trim()} /></span>{item.subtitle ? <span className={`mt-0.5 block truncate text-[11px] ${activeIndex === itemIndex ? "text-slate-300" : "text-slate-500"}`}><Highlight text={item.subtitle} query={query.trim()} /></span> : null}</span>
                            {activeIndex === itemIndex ? <kbd className="rounded-md border border-white/20 px-2 py-1 text-[9px] font-bold text-slate-300">Entrée</kbd> : null}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <footer className="flex items-center gap-4 border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-[10px] font-bold text-slate-400"><span>↑↓ Naviguer</span><span>↵ Ouvrir</span><span>Échap Fermer</span><span className="ml-auto">Top 5 par catégorie</span></footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
