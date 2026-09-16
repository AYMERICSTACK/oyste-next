"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleCheckBig, ExternalLink, Loader2, PackageCheck, RefreshCw, XCircle } from "lucide-react";

type Draft = {
  id: string;
  reference: string;
  designation: string;
  category: string | null;
  sourceUrl: string;
  purchasePriceExVat: number | null;
  stock: number | null;
  stockLabel: string;
  weightKg: number | null;
  status: string;
  sourceReadAt: string | null;
  preparedAt: string;
  product: {
    id: string;
    code: string;
    name: string;
    publicationStatus: string;
  } | null;
};

type ImportResult = {
  draftId: string;
  reference?: string;
  productId?: string;
  status: "complete" | "partial" | "existing" | "error";
  completeness?: number;
  missing?: string[];
  message?: string;
};

type ImportSummary = {
  complete: number;
  partial: number;
  existing: number;
  errors: number;
};

function money(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

export default function StockmanImportDraftReviewCard() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastResults, setLastResults] = useState<ImportResult[]>([]);
  const [lastSummary, setLastSummary] = useState<ImportSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/suppliers/stockman/import-drafts", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Lecture des brouillons impossible.");
      setDrafts(Array.isArray(payload.drafts) ? payload.drafts : []);
      const excluded = Number(payload.cleanup?.excluded ?? 0);
      const excludedReferences = Array.isArray(payload.cleanup?.references) ? payload.cleanup.references : [];
      const referenceReady = payload.cleanup?.referenceReady !== false;
      if (!referenceReady) {
        setMessage("Référentiel STOCKMAN en cours de restauration : aucun brouillon n’a été supprimé. Rechargez cette carte une fois l’audit persistant restauré.");
      } else if (excluded > 0) {
        setMessage(
          `${excluded} brouillon(s) hors référentiel actif masqué(s) : ${excludedReferences.join(", ")}. Aucune suppression n’a été effectuée en base.`,
        );
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Lecture des brouillons impossible.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const prepared = useMemo(() => drafts.filter((draft) => draft.status === "PREPARED" && !draft.product), [drafts]);
  const imported = useMemo(() => drafts.filter((draft) => draft.status === "IMPORTED" || draft.product), [drafts]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function createSelected() {
    const draftIds = [...selected];
    if (!draftIds.length) return;

    setCreating(true);
    setMessage(null);
    try {
      const allResults: ImportResult[] = [];
      const summary: ImportSummary = { complete: 0, partial: 0, existing: 0, errors: 0 };
      let created = 0;
      for (let offset = 0; offset < draftIds.length; offset += 20) {
        const batch = draftIds.slice(offset, offset + 20);
        const response = await fetch("/api/admin/suppliers/stockman/import-drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create_products", draftIds: batch }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || `Création catalogue impossible (lot ${Math.floor(offset / 20) + 1}).`);
        allResults.push(...(Array.isArray(payload.results) ? payload.results as ImportResult[] : []));
        created += Number(payload.created ?? 0);
        summary.complete += Number(payload.summary?.complete ?? 0);
        summary.partial += Number(payload.summary?.partial ?? 0);
        summary.existing += Number(payload.summary?.existing ?? 0);
        summary.errors += Number(payload.summary?.errors ?? 0);
      }
      setLastResults(allResults);
      setLastSummary(summary);
      setMessage(`${created}/${draftIds.length} produit(s) traité(s) en brouillon OYSTE · ${summary.complete} complet(s) · ${summary.partial} partiel(s) · ${summary.existing} déjà présent(s) · ${summary.errors} erreur(s). Aucun produit n’a été publié automatiquement.`);
      setSelected(new Set());
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Création catalogue impossible.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="mt-7 overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between md:p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black">Brouillons d’import Stockman</h2>
            <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-orange-700">
              RC4.2 V2.10.9 · Pipeline catalogue
            </span>
          </div>
          <p className="mt-2 max-w-5xl text-sm leading-6 text-slate-500">
            Vous pouvez sélectionner tous les brouillons : OYSTE les traite automatiquement par lots de 20. OYSTE relit chaque fiche Stockman, enrichit automatiquement le brouillon et produit un bilan complet avant toute publication. Le prix d’achat fournisseur n’est jamais utilisé comme prix de vente.
          </p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-xs font-black disabled:opacity-50">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Actualiser
        </button>
      </div>

      <div className="p-5 md:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="À valider" value={prepared.length} />
          <Metric label="Sélectionnés" value={selected.size} />
          <Metric label="Créés dans OYSTE" value={imported.length} />
        </div>

        {message ? <div className="mt-4 rounded-xl border border-cyan-100 bg-cyan-50 p-4 text-sm font-bold text-cyan-900">{message}</div> : null}

        {lastSummary && lastResults.length ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-black text-slate-950">Bilan du dernier import</p>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  Chaque référence reste en brouillon jusqu’à votre validation.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusCounter label="Complets" value={lastSummary.complete} tone="complete" />
                <StatusCounter label="Partiels" value={lastSummary.partial} tone="partial" />
                <StatusCounter label="Déjà présents" value={lastSummary.existing} tone="existing" />
                <StatusCounter label="Erreurs" value={lastSummary.errors} tone="error" />
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              {lastResults.map((result) => (
                <div key={`${result.draftId}-${result.reference || ""}`} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <ResultIcon status={result.status} />
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-950">{result.reference || "Référence inconnue"}</p>
                      <p className="mt-0.5 text-xs font-bold text-slate-500">{result.message || "Traitement terminé."}</p>
                      {result.missing?.length ? (
                        <p className="mt-1 text-[11px] font-bold text-amber-700">
                          À compléter : {result.missing.join(", ")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {typeof result.completeness === "number" ? (
                      <span className="text-xs font-black text-slate-500">{result.completeness}%</span>
                    ) : null}
                    {result.productId ? (
                      <Link href={`/admin/catalogue/${result.productId}`} className="text-xs font-black text-[#007f8f] hover:underline">
                        Ouvrir
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelected(new Set(prepared.map((draft) => draft.id)))}
            disabled={!prepared.length}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black disabled:opacity-40"
          >
            Sélectionner tous les brouillons
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            disabled={!selected.size}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black disabled:opacity-40"
          >
            Désélectionner
          </button>
          <button
            type="button"
            onClick={() => void createSelected()}
            disabled={!selected.size || creating}
            className="ml-auto inline-flex items-center gap-2 rounded-xl bg-[#007f8f] px-5 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {creating ? <Loader2 size={16} className="animate-spin" /> : <PackageCheck size={16} />}
            Créer {selected.size} produit(s) en brouillon OYSTE
          </button>
        </div>

        {loading ? (
          <div className="mt-5 rounded-2xl border border-slate-200 p-8 text-center text-sm font-bold text-slate-500">
            Chargement des brouillons…
          </div>
        ) : drafts.length ? (
          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[1100px] w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-12 px-4 py-3"></th>
                  <th className="px-4 py-3">Référence</th>
                  <th className="px-4 py-3">Désignation</th>
                  <th className="px-4 py-3">Catégorie</th>
                  <th className="px-4 py-3">Prix achat HT</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Poids</th>
                  <th className="px-4 py-3">État</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drafts.map((draft) => {
                  const selectable = draft.status === "PREPARED" && !draft.product;
                  return (
                    <tr key={draft.id} className={selected.has(draft.id) ? "bg-cyan-50/50" : "bg-white"}>
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selected.has(draft.id)}
                          disabled={!selectable}
                          onChange={() => toggle(draft.id)}
                          className="h-4 w-4 accent-[#007f8f]"
                        />
                      </td>
                      <td className="px-4 py-4 text-xs font-black text-slate-950">{draft.reference}</td>
                      <td className="max-w-[330px] px-4 py-4 text-xs font-bold text-slate-700">{draft.designation}</td>
                      <td className="px-4 py-4 text-xs font-bold text-slate-500">{draft.category || "À classer"}</td>
                      <td className="px-4 py-4 text-xs font-black text-slate-950">{money(draft.purchasePriceExVat)}</td>
                      <td className="px-4 py-4 text-xs font-black text-slate-950">{draft.stockLabel}</td>
                      <td className="px-4 py-4 text-xs font-bold text-slate-600">{draft.weightKg === null ? "—" : `${draft.weightKg} kg`}</td>
                      <td className="px-4 py-4">
                        {draft.product ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black uppercase text-emerald-700">
                            <CheckCircle2 size={12} /> Créé · brouillon
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-black uppercase text-amber-800">
                            À valider
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <a href={draft.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-black text-cyan-700 hover:underline">
                            Stockman <ExternalLink size={12} />
                          </a>
                          {draft.product ? (
                            <Link href={`/admin/catalogue/${draft.product.id}`} className="text-[10px] font-black text-slate-900 hover:underline">
                              Ouvrir OYSTE
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-slate-200 p-8 text-center text-sm font-bold text-slate-500">
            Aucun brouillon Stockman préparé pour le moment.
          </div>
        )}

        <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4 text-xs font-bold leading-5 text-orange-900">
          Sécurité V2.12.9 : toute création reste en <strong>Brouillon</strong>. Le PV HT est calculé avec la marge STOCKMAN validée (<strong>PA / 0,80</strong>) et la livraison est <strong>incluse</strong>. Si le PA est « Nous consulter », la valeur technique 0 n’est jamais considérée comme un prix vendable : la fiche reste en mode devis.
        </div>
      </div>
    </section>
  );
}

function ResultIcon({ status }: { status: ImportResult["status"] }) {
  if (status === "complete") return <CircleCheckBig size={18} className="mt-0.5 shrink-0 text-emerald-600" />;
  if (status === "partial") return <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />;
  if (status === "existing") return <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-cyan-700" />;
  return <XCircle size={18} className="mt-0.5 shrink-0 text-red-600" />;
}

function StatusCounter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: ImportResult["status"];
}) {
  const styles = {
    complete: "bg-emerald-50 text-emerald-700",
    partial: "bg-amber-50 text-amber-800",
    existing: "bg-cyan-50 text-cyan-800",
    error: "bg-red-50 text-red-700",
  };

  return (
    <span className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wide ${styles[tone]}`}>
      {value} {label}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}
