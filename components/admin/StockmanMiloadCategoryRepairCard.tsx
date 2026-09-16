"use client";

import { useState } from "react";
import { CheckCircle2, FolderTree, Loader2, Wrench } from "lucide-react";

type Preview = {
  version: string;
  target: { id: string; name: string; path: string | null } | null;
  expected: number;
  found: number;
  missingCodes: string[];
  toRepair: number;
  alreadyCategorized: number;
  products: Array<{
    id: string;
    code: string;
    name: string;
    categoryId: string | null;
    category: { name: string; path: string | null } | null;
  }>;
};

export default function StockmanMiloadCategoryRepairCard() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [working, setWorking] = useState<"preview" | "apply" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadPreview() {
    setWorking("preview");
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/suppliers/stockman/miload-category-repair", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Prévisualisation impossible.");
      setPreview(payload as Preview);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Prévisualisation impossible.");
    } finally {
      setWorking(null);
    }
  }

  async function applyRepair() {
    if (!preview?.target || preview.toRepair === 0) return;
    const expected = `CLASSER MILOAD ${preview.toRepair}`;
    const confirmation = window.prompt(
      `Classement des accessoires MILOAD\n\n` +
      `${preview.toRepair} fiche(s) sans catégorie seront rattachées à :\n` +
      `${preview.target.path || preview.target.name}\n\n` +
      `Tapez exactement ${expected} pour confirmer.`,
    );
    if (confirmation !== expected) return;

    setWorking("apply");
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/suppliers/stockman/miload-category-repair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Classement impossible.");
      setMessage(payload.message || "Classement terminé.");
      await loadPreview();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Classement impossible.");
    } finally {
      setWorking(null);
    }
  }

  return (
    <section className="rounded-[1.4rem] border border-cyan-200 bg-cyan-50/50 p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FolderTree size={18} className="text-cyan-700" />
            <h3 className="text-base font-black text-slate-950">Catégories accessoires MILOAD · V2.11.3.2</h3>
          </div>
          <p className="mt-2 max-w-4xl text-xs font-bold leading-5 text-slate-600">
            Corrige uniquement les 12 références STOCKMAN MILOAD signalées sans catégorie par l’audit.
            La catégorie cible existante est affichée avant toute écriture.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void loadPreview()} disabled={working !== null}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-black text-white disabled:opacity-40">
            {working === "preview" ? <Loader2 size={15} className="animate-spin" /> : <FolderTree size={15} />}
            Prévisualiser les 12
          </button>
          <button type="button" onClick={() => void applyRepair()}
            disabled={working !== null || !preview?.target || !preview || preview.toRepair === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-4 py-3 text-xs font-black text-white disabled:opacity-40">
            {working === "apply" ? <Loader2 size={15} className="animate-spin" /> : <Wrench size={15} />}
            Classer {preview?.toRepair || 0} fiche(s)
          </button>
        </div>
      </div>

      {message ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-black text-emerald-800">{message}</div> : null}
      {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-black text-red-700">{error}</div> : null}

      {preview ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric value={preview.found} label="Références trouvées" />
            <Metric value={preview.toRepair} label="À classer" />
            <Metric value={preview.alreadyCategorized} label="Déjà classées" />
            <Metric value={preview.missingCodes.length} label="Références absentes" />
          </div>

          {preview.target ? (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-black text-emerald-800">
              <CheckCircle2 size={17} />
              Catégorie cible existante : {preview.target.path || preview.target.name}
            </div>
          ) : null}

          <details className="overflow-hidden rounded-xl border border-cyan-100 bg-white">
            <summary className="cursor-pointer px-4 py-3 text-xs font-black text-cyan-900">Voir les références ({preview.products.length})</summary>
            <div className="max-h-[320px] overflow-auto border-t border-cyan-100">
              {preview.products.map((product) => (
                <div key={product.id} className="border-b border-slate-100 p-4 last:border-b-0">
                  <p className="text-xs font-black text-slate-950">{product.code} · {product.name}</p>
                  <p className="mt-1 text-[10px] font-bold text-slate-500">
                    {product.category ? `Déjà classé : ${product.category.path || product.category.name}` : "Sans catégorie"}
                  </p>
                </div>
              ))}
            </div>
          </details>
        </div>
      ) : null}
    </section>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return <div className="rounded-xl border border-cyan-100 bg-white px-4 py-4">
    <p className="text-2xl font-black text-slate-950">{value}</p>
    <p className="mt-1 text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</p>
  </div>;
}
