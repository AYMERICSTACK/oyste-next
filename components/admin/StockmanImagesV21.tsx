"use client";
import { useState } from "react";
type Group = { key: string; title: string; references: number; status: string; url: string };
type Preview = { rows: Group[]; counts: { groups: number; toAdd: number; existing: number; issues: number } };
type Result = { attached: number; skipped: number; outcomes: { title: string; status: string; reason?: string }[] };
const endpoint = "/api/admin/suppliers/stockman/diables-images";
export default function StockmanImagesV21() {
 const [preview, setPreview] = useState<Preview|null>(null);
 const [result, setResult] = useState<Result|null>(null);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState("");
 const [confirmed, setConfirmed] = useState(false);
 async function verify() {
  setBusy(true); setError(""); setResult(null); setConfirmed(false);
  try { const res = await fetch(endpoint, { cache: "no-store" }); const data = await res.json(); if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`); setPreview(data as Preview); }
  catch(e) { setError(e instanceof Error ? e.message : "Erreur de lecture"); setPreview(null); }
  finally { setBusy(false); }
 }
 async function apply() {
  if (!preview || !confirmed || busy) return;
  const keys = preview.rows.filter(r => r.status === "A_AJOUTER").map(r => r.key);
  if (!keys.length) return;
  setBusy(true);setError("");setConfirmed(false);
  try { const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "ATTACH_DRAFT_IMAGES", acknowledged: true, keys }) }); const data = await res.json(); if(!res.ok) throw new Error(data.error || `HTTP ${res.status}`); setResult(data as Result); setPreview(null); }
  catch(e) { setError(e instanceof Error ? e.message : "Erreur de mise a jour"); }
  finally { setBusy(false); }
 }
 return <section className="mt-5 rounded-xl border border-slate-300 bg-white p-4 text-sm text-slate-900">
  <h3 className="text-lg font-semibold">STOCKMAN V21 — Images des 45 produits DRAFT</h3>
  <p className="mt-1 text-slate-600">Images de gamme retrouvees dans le catalogue fournisseur local. Ajout uniquement aux parents sans image. Aucune image existante ecrasee, aucun prix ou stock modifie, aucune publication. Photos a verifier visuellement avant mise en vente.</p>
  <button type="button" disabled={busy} onClick={verify} className="mt-3 rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-40">{busy ? "Verification en cours…" : "Verifier les images des 45 produits"}</button>
  {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}
  {preview && <><p className="mt-3 font-semibold">{preview.counts.groups} groupes · {preview.counts.toAdd} images a ajouter · {preview.counts.existing} images deja presentes · {preview.counts.issues} exceptions</p>
   <div className="mt-3 max-h-72 overflow-auto rounded border"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-2">Produit</th><th className="p-2">Variantes</th><th className="p-2">Image</th></tr></thead><tbody>{preview.rows.map(r=><tr key={r.key} className="border-t"><td className="p-2">{r.title}</td><td className="p-2">{r.references}</td><td className="p-2">{r.status}</td></tr>)}</tbody></table></div>
   {preview.counts.toAdd>0 && <div className="mt-3 rounded-lg border border-amber-200 p-3"><label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>Je confirme l'ajout des {preview.counts.toAdd} images de gamme aux fiches DRAFT. Je verifierai les photos avant publication.</span></label><button type="button" disabled={!confirmed||busy} onClick={apply} className="mt-3 rounded bg-amber-800 px-4 py-2 text-white disabled:opacity-40">Ajouter les images aux brouillons</button></div>}
  </>}
  {result && <div className="mt-3 rounded bg-slate-50 p-3"><p className="font-semibold">{result.attached} images ajoutees · {result.skipped} ignorees. Aucune publication.</p>{result.skipped>0 && <p className="mt-2 text-xs">{result.outcomes.filter(r=>r.status==="SKIPPED").map(r=>`${r.title}: ${r.reason||"erreur"}`).join(" | ")}</p>}</div>}
 </section>;
}
