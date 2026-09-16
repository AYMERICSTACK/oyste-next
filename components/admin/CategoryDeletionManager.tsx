"use client";

import { useMemo, useState } from "react";
import { Search, Trash2 } from "lucide-react";

export type DeletableCategory = {
  id: string;
  name: string;
  path: string;
  productCount: number;
  childCount: number;
};

export default function CategoryDeletionManager({ categories }: { categories: DeletableCategory[] }) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [removed, setRemoved] = useState<string[]>([]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return categories
      .filter((category) => !removed.includes(category.id))
      .filter((category) => !needle || `${category.path} ${category.name}`.toLowerCase().includes(needle));
  }, [categories, query, removed]);

  async function removeCategory(category: DeletableCategory) {
    if (category.productCount > 0 || category.childCount > 0) {
      setMessage(`Impossible de supprimer « ${category.path} » : ${category.productCount} produit(s) et ${category.childCount} sous-catégorie(s) sont encore rattachés.`);
      return;
    }
    const confirmation = window.prompt(`Suppression définitive de « ${category.path} ».\nTapez exactement SUPPRIMER pour confirmer.`);
    if (confirmation !== "SUPPRIMER") return;

    setBusy(category.id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/categories/${encodeURIComponent(category.id)}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Suppression impossible.");
      setRemoved((current) => [...current, category.id]);
      setMessage(`Catégorie « ${category.path} » supprimée.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Suppression impossible.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <details className="mt-5 rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
      <summary className="cursor-pointer px-5 py-4 text-xs font-black text-slate-800">
        Gérer / supprimer les catégories
      </summary>
      <div className="border-t border-slate-200 p-5">
        <div className="flex items-center gap-3 rounded-xl bg-slate-100 px-4 py-3">
          <Search size={17} className="text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher une catégorie…"
            className="w-full bg-transparent text-sm font-bold outline-none"
          />
        </div>
        {message ? <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-700">{message}</div> : null}
        <div className="mt-4 max-h-[480px] space-y-2 overflow-auto">
          {visible.map((category) => {
            const blocked = category.productCount > 0 || category.childCount > 0;
            return (
              <div key={category.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="truncate text-xs font-black text-slate-950">{category.path}</div>
                  <div className="mt-1 text-[10px] font-bold text-slate-400">
                    {category.productCount} produit(s) · {category.childCount} sous-catégorie(s)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void removeCategory(category)}
                  disabled={busy === category.id}
                  className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[11px] font-black ${
                    blocked ? "bg-slate-100 text-slate-500" : "bg-red-50 text-red-700 hover:bg-red-100"
                  }`}
                  title={blocked ? "Videz d’abord les produits et sous-catégories." : "Supprimer la catégorie"}
                >
                  <Trash2 size={14} />
                  {busy === category.id ? "Suppression…" : blocked ? "Suppression bloquée" : "Supprimer"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </details>
  );
}
