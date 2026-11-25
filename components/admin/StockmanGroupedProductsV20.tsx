"use client";

import { useState } from "react";

type Group = { key: string; title: string; references: string[]; ready: boolean; blockers: string[]; documentCount: number; hasDescription: boolean; categoryId: string | null };
type Preview = { groups: Group[]; totalGroups: number; totalReferences: number; readyGroups: number; checkedAt: string };
type Result = { createdGroups: number; createdVariants: number; results: { title: string; status: string; reason?: string }[] };
const ENDPOINT = "/api/admin/suppliers/stockman/diables-product-batch";
export default function StockmanGroupedProductsV20() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  async function load() {
    setBusy(true); setError(""); setResult(null); setConfirm(false);
    try {
      const res = await fetch(ENDPOINT, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setPreview(json as Preview);
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur de lecture"); setPreview(null); }
    finally { setBusy(false); }
  }
  async function create() {
    if (!preview || !confirm || busy || !preview.groups.some(g => g.ready)) return;
    const keys = preview.groups.filter(g => g.ready).map(g => g.key);
    setBusy(true); setError(""); setConfirm(false);
    try {
      const res = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "CREATE_GROUPED_PRODUCTS_DRAFT", acknowledged: true, keys }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setResult(json as Result);
      setPreview(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Import impossible"); }
    finally { setBusy(false); }
  }
  const ready = preview?.groups.filter(g => g.ready) ?? [];
  const blocked = preview?.groups.filter(g => !g.ready) ?? [];
  return <section className="mt-5 rounded-xl border border-slate-300 bg-white p-4 text-sm text-slate-900">
    <h3 className="text-lg font-semibold">STOCKMAN V20 — Fiches produits groupées (non publiées)</h3>
    <p className="mt-1 text-slate-600">79 brouillons / 45 groupes candidats. Prix de vente exclusivement depuis Neon ; aucun calcul de marge ou publication automatique. Stock inconnu = « à confirmer ».</p>
    <button type="button" disabled={busy} onClick={load} className="mt-3 rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50">{busy ? "Traitement en cours…" : "Vérifier les 45 groupes dans Neon"}</button>
    {error ? <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-red-800">{error}</p> : null}
    {preview ? <>
      <p className="mt-3 font-semibold">{preview.totalGroups} groupes contrôlés · {preview.totalReferences} références · {ready.length} groupes admissibles · {blocked.length} groupes à conserver en brouillons d'import.</p>
      <p className="mt-1 text-xs text-slate-600">Si des prix de vente sont absents de Neon, les groupes concernés ne seront pas créés. Les documents PDF des fiches admissibles seront rattachés aux parents ; aucune image non vérifiée n'est inventée.</p>
      <div className="mt-3 max-h-72 overflow-auto rounded-lg border"><table className="w-full min-w-[680px] text-left text-xs"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-2">Groupe</th><th className="p-2">Références</th><th className="p-2">Documents</th><th className="p-2">Décision</th></tr></thead><tbody>{preview.groups.map(g => <tr key={g.key} className="border-t"><td className="p-2">{g.title}</td><td className="p-2">{g.references.join(", ")}</td><td className="p-2">{g.documentCount} PDF</td><td className="p-2">{g.ready ? "Admissible (DRAFT uniquement)" : g.blockers.join(" ; ")}</td></tr>)}</tbody></table></div>
      {ready.length ? <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
        <label className="flex items-start gap-2"><input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} className="mt-1"/><span>Je confirme la création dans Neon de <strong>{ready.length} produits parents et {ready.reduce((n,g) => n+g.references.length,0)} variantes</strong> en statut DRAFT, sans publication, en conservant les groupes non admissibles.</span></label>
        <button type="button" disabled={busy || !confirm} onClick={create} className="mt-3 rounded-lg bg-amber-800 px-4 py-2 font-medium text-white disabled:opacity-40">Créer les fiches en brouillon</button>
      </div> : <p className="mt-3 text-amber-800">Aucun groupe n'est actuellement admissible. Vérifier les prix de vente STOCKMAN enregistrés dans Neon et les brouillons existants.</p>}
    </> : null}
    {result ? <div className="mt-4 rounded-lg bg-slate-50 p-3"><p className="font-semibold">Création terminée : {result.createdGroups} parents / {result.createdVariants} variantes en DRAFT. Aucune publication.</p><p className="mt-2 text-xs">{result.results.filter(r => r.status !== "CREATED_DRAFT").map(r => `${r.title}: ${r.reason || r.status}`).join(" | ") || "Aucune erreur signalée."}</p></div> : null}
  </section>;
}
