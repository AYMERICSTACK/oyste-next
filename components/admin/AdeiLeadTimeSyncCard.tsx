"use client";

import { useState } from "react";
import { CheckCircle2, Clock3, Loader2, RefreshCw, TriangleAlert } from "lucide-react";

type SyncResult = {
  fetchedAt: string;
  sourceRows: number;
  updatedProducts: number;
  updatedVariants: number;
  skippedProducts: number;
  families: Array<{ label: string; weeks: number }>;
};

export default function AdeiLeadTimeSyncCard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState("");

  async function sync() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/suppliers/adei/lead-times", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Synchronisation impossible.");
      setResult(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Synchronisation impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">Délais fournisseur</p>
          <h3 className="mt-2 text-xl font-black">Synchronisation des délais</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Les délais indicatifs sont actualisés automatiquement chaque mardi à 18h00. Une mise à jour manuelle peut être lancée à tout moment.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void sync()}
          disabled={loading}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#007f8f] px-5 py-3 text-xs font-black text-white disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          {loading ? "Mise à jour…" : "Mettre à jour les délais"}
        </button>
      </div>

      {result ? (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="flex items-center gap-2 text-sm font-black text-emerald-800">
            <CheckCircle2 size={17} /> Synchronisation terminée
          </p>
          <p className="mt-2 text-xs font-bold leading-5 text-emerald-700">
            {result.updatedProducts} produit(s) et {result.updatedVariants} variante(s) actualisés · {result.sourceRows} règle(s) fournisseur lues.
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
            <Clock3 size={13} /> {new Date(result.fetchedAt).toLocaleString("fr-FR")}
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm font-black text-amber-900">
            <TriangleAlert size={17} /> Mise à jour impossible
          </p>
          <p className="mt-2 text-xs font-bold leading-5 text-amber-800">
            {error} Les derniers délais enregistrés sont conservés.
          </p>
        </div>
      ) : null}

      {result?.families?.length ? (
        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {result.families.map((family) => (
            <div key={family.label} className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="truncate text-xs font-black text-slate-800">{family.label}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                Délai indicatif : {family.weeks} semaine{family.weeks > 1 ? "s" : ""}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
