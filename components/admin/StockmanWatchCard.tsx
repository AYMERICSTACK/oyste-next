"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Download, RefreshCw, Search } from "lucide-react";

type Change = { reference: string; designation: string; previousSaleHT: number; candidateSaleHT: number };
type NewProduct = { reference: string; designation: string; sourceUrl: string; candidateSaleHT: number | null };
type Issue = { page: number; reason: string };
type Batch = { nextCursor: number | null; totalPages: number; processedPages: number; changes: Change[]; newProducts: NewProduct[]; issues: Issue[] };

const STOCKMAN_WATCH_STORAGE_V274 = "oyste-stockman-watch-v274";

const money = (value: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);

export default function StockmanWatchCard({ onOpenDiscovery }: { onOpenDiscovery: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [changes, setChanges] = useState<Change[]>([]);
  const [newProducts, setNewProducts] = useState<NewProduct[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [finished, setFinished] = useState(false);
  const stop = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STOCKMAN_WATCH_STORAGE_V274);
      if (!raw) return;
      const snapshot = JSON.parse(raw);
      if (
        !snapshot ||
        !Array.isArray(snapshot.changes) ||
        !Array.isArray(snapshot.newProducts) ||
        !Array.isArray(snapshot.issues) ||
        !Number.isFinite(snapshot.done) ||
        !Number.isFinite(snapshot.total)
      ) return;

      setChanges(snapshot.changes);
      setNewProducts(snapshot.newProducts);
      setIssues(snapshot.issues);
      setProgress({ done: snapshot.done, total: snapshot.total });
      setFinished(snapshot.finished === true);
    } catch {
      // Une sauvegarde illisible ne bloque pas le BO.
    }
  }, []);

  function saveSnapshot(
    done: number,
    total: number,
    savedChanges: Change[],
    savedNew: NewProduct[],
    savedIssues: Issue[],
    isFinished: boolean,
  ) {
    try {
      localStorage.setItem(
        STOCKMAN_WATCH_STORAGE_V274,
        JSON.stringify({
          savedAt: new Date().toISOString(),
          done,
          total,
          changes: savedChanges,
          newProducts: savedNew,
          issues: savedIssues,
          finished: isFinished,
        }),
      );
    } catch {
      setError("Sauvegarde locale indisponible : exportez les résultats.");
    }
  }
  async function scan() {
    stop.current = false;
    setBusy(true); setFinished(false); setError("");
    setChanges([]); setNewProducts([]); setIssues([]); setProgress({ done: 0, total: 0 });
    const allChanges = new Map<string, Change>();
    const allNew = new Map<string, NewProduct>();
    const allIssues: Issue[] = [];
    try {
      const initial = await fetch("/api/admin/suppliers/stockman/watch", { cache: "no-store" });
      const initialData = await initial.json();
      if (!initial.ok) throw new Error(initialData.message || "Impossible de charger les références.");
      if (!initialData.totalPages) throw new Error("Aucune page source STOCKMAN disponible dans le catalogue vivant. Lancez d'abord la découverte.");
      setProgress({ done: 0, total: initialData.totalPages });
      let cursor: number | null = 0;
      while (cursor !== null && !stop.current) {
        const response = await fetch("/api/admin/suppliers/stockman/watch", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cursor, batchSize: 1 }),
        });
        const data = await response.json() as Batch & { message?: string };
        if (!response.ok) throw new Error(data.message || "Le scan STOCKMAN a échoué.");
        for (const item of data.changes) allChanges.set(item.reference, item);
        for (const item of data.newProducts) allNew.set(item.reference, item);
        allIssues.push(...data.issues);
        setChanges([...allChanges.values()]);
        setNewProducts([...allNew.values()]);
        setIssues([...allIssues]);
        setProgress({ done: cursor + data.processedPages, total: data.totalPages });
        saveSnapshot(
          cursor + data.processedPages,
          data.totalPages,
          [...allChanges.values()],
          [...allNew.values()],
          [...allIssues],
          data.nextCursor === null,
        );
        cursor = data.nextCursor;
      }
      if (!stop.current) setFinished(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erreur de synchronisation.");
    } finally {
      setBusy(false);
    }
  }

  function exportPreview() {
    const payload = {
      supplier: "STOCKMAN", createdAt: new Date().toISOString(),
      status: "PREVIEW_ONLY_NOT_APPROVED", marginOnSale: 0.20,
      scannedPages: progress.done, totalPages: progress.total,
      changes, newProducts, issues,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "stockman-apercu-synchronisation.json"; link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-[1.5rem] border border-cyan-200 bg-white p-5 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-700">Veille fournisseur · STOCKMAN</p>
      <h3 className="mt-2 text-xl font-black">Rechercher les nouveautés</h3>
      <p className="mt-2 text-sm text-slate-600">
        Compare les tarifs revendeur avec les prix de vente OYSTE (marge 20 %), et repère les références absentes du catalogue.
        Lecture seule : aucun prix d’achat n’est transmis au navigateur.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void scan()} className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
          <RefreshCw size={16} /> {busy ? "Recherche en cours…" : "Rechercher les nouveautés STOCKMAN"}
        </button>
        {busy && <button type="button" onClick={() => { stop.current = true; }} className="rounded-xl border px-4 py-3 text-sm font-bold">Arrêter après cette page</button>}
        <button type="button" onClick={onOpenDiscovery} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold"><Search size={16} /> Découvrir / préparer les nouveaux produits</button>
        {!busy && progress.done > 0 && <button type="button" onClick={exportPreview} className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold"><Download size={16} /> Exporter l’aperçu</button>}
      </div>
      {progress.total > 0 && <p className="mt-3 text-xs text-slate-600">Pages traitées : {progress.done} / {progress.total} {finished ? "· terminé" : ""}</p>}
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-4"><strong className="text-2xl">{changes.length}</strong><p className="text-xs">Prix de vente différents</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><strong className="text-2xl">{newProducts.length}</strong><p className="text-xs">Nouvelles références repérées</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><strong className="text-2xl">{issues.length}</strong><p className="text-xs">Pages à revoir</p></div>
      </div>
      {changes.length > 0 && <div className="mt-5 overflow-x-auto"><h4 className="mb-2 font-bold">Prix modifiés · à valider</h4><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-2">Référence</th><th>Ancien prix HT</th><th>Nouveau prix HT</th></tr></thead><tbody>{changes.map(item => <tr className="border-b" key={item.reference}><td className="py-2 font-semibold">{item.reference}</td><td>{money(item.previousSaleHT)}</td><td className="font-bold">{money(item.candidateSaleHT)}</td></tr>)}</tbody></table></div>}
      {newProducts.length > 0 && <div className="mt-5"><h4 className="mb-2 font-bold">Nouvelles références · à qualifier</h4><ul className="space-y-2">{newProducts.map(item => <li className="rounded-lg border p-3 text-sm" key={item.reference}><strong>{item.reference}</strong> · {item.designation || "Désignation à compléter"} {item.candidateSaleHT !== null ? `· ${money(item.candidateSaleHT)} HT` : "· Nous consulter"}</li>)}</ul></div>}
      {issues.length > 0 && <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle size={18} /> {issues.length} page(s) non vérifiée(s). Le résultat ne peut pas être considéré comme exhaustif.</p>}
      <p className="mt-4 text-xs leading-5 text-slate-500">Aucune application automatique : les prix du catalogue public sont des fichiers versionnés. L’export doit être contrôlé et intégré au dépôt avant publication. Pour les nouvelles fiches, utilisez le module de découverte et d’import existant.</p>
    </section>
  );
}
