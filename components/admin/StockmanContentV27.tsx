"use client";

import { useState } from "react";

type Row = { id: string; productCode: string; title: string; subcategory: string; category: string; categoryAction: string; descriptionAction: string; blockers: string[]; oldLength: number; newLength: number };
type Preview = { total: number; categoryReady: number; descriptionsReady: number; rows: Row[] };
type Result = { categoriesUpdated: number; descriptionsUpdated: number; skipped: { code: string; reason: string }[] };
const phrase = "CORRIGER 45 FICHES STOCKMAN";

export default function StockmanContentV27() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  async function check() {
    setLoading(true); setError(""); setResult(null); setConfirm("");
    try {
      const r = await fetch("/api/admin/suppliers/stockman/diables-content", { cache: "no-store" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setPreview(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur de lecture."); }
    finally { setLoading(false); }
  }
  async function apply() {
    if (!preview || confirm !== phrase) return;
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/admin/suppliers/stockman/diables-content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "APPLY_DIABLES_CONTENT_V27", confirmation: phrase, selectedCodes: preview.rows.map(row => row.productCode) }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setResult(data); setPreview(null); setConfirm("");
    } catch (e) { setError(e instanceof Error ? e.message : "Echec de la correction."); }
    finally { setLoading(false); }
  }
  return <section className="my-5 space-y-3 rounded-xl border border-cyan-300 bg-white p-4 text-sm">
    <h3 className="text-base font-bold">STOCKMAN V27 — Catégories et descriptions des 45 fiches DRAFT</h3>
    <p className="text-slate-700">Rattachement aux catégories existantes uniquement si le libellé est unique. Suppression du tableau brut de références et des répétitions dans les descriptions d'origine uniquement. Aucun PDF, photo, prix, stock ni statut de publication modifié.</p>
    <button type="button" onClick={check} disabled={loading} className="rounded bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50">{loading ? "Traitement…" : "Prévisualiser les 45 fiches dans Neon"}</button>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {preview && <>
      <div className="font-semibold">{preview.total} fiches contrôlées · {preview.categoryReady} catégories à rattacher · {preview.descriptionsReady} descriptions à nettoyer</div>
      <p className="text-amber-800">Les cas sans catégorie unique ou avec une description déjà modifiée sont conservés pour vérification manuelle.</p>
      <div className="max-h-80 overflow-auto rounded border"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-2">Produit</th><th className="p-2">Sous-famille</th><th className="p-2">Catégorie</th><th className="p-2">Description</th><th className="p-2">Exceptions</th></tr></thead><tbody>{preview.rows.map(row => <tr key={row.productCode} className="border-t"><td className="p-2">{row.title}</td><td className="p-2">{row.subcategory}</td><td className="p-2">{row.categoryAction}</td><td className="p-2">{row.descriptionAction} ({row.oldLength} → {row.newLength} caractères)</td><td className="p-2">{row.blockers.join(", ") || "—"}</td></tr>)}</tbody></table></div>
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3"><label className="block font-semibold">Pour autoriser les corrections, saisis exactement {phrase} :</label><input className="mt-2 w-full max-w-sm rounded border p-2" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder={phrase}/><div className="mt-2"><button type="button" disabled={loading || confirm !== phrase} onClick={apply} className="rounded bg-cyan-800 px-4 py-2 font-semibold text-white disabled:opacity-40">Appliquer uniquement les corrections sûres</button></div></div>
    </>}
    {result && <p className="rounded bg-slate-100 p-3 font-semibold">Terminé : {result.categoriesUpdated} catégories rattachées · {result.descriptionsUpdated} descriptions nettoyées · {result.skipped.length} fiches sans modification. Aucune publication.</p>}
  </section>;
}
