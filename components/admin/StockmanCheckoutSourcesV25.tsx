"use client";
import { useState } from "react";

type Row = { code: string; title: string; sourceReady: boolean; action: string; issues: string[] };
type Preview = { total: number; missing: number; already: number; blocked: number; rows: Row[] };
const TOKEN = "RACCORDER STOCKMAN 45 URL";
export default function StockmanCheckoutSourcesV25() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [confirmation, setConfirmation] = useState("");
  async function load() {
    setBusy(true); setError(""); setResult(""); setConfirmation("");
    try {
      const res = await fetch("/api/admin/suppliers/stockman/diables-checkout-source", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setPreview(data as Preview);
    } catch (e) { setPreview(null); setError(e instanceof Error ? e.message : "Erreur de lecture"); }
    finally { setBusy(false); }
  }
  async function apply() {
    if (busy || !preview || preview.blocked || preview.total !== 45 || preview.missing === 0 || confirmation !== TOKEN) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/admin/suppliers/stockman/diables-checkout-source", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: TOKEN }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult(`${data.updated} URL fournisseur raccordee(s) ; ${data.already} deja presentes. Tous les produits restent DRAFT. Aucun prix ni stock modifie.`);
      setConfirmation("");
      const check = await fetch("/api/admin/suppliers/stockman/diables-checkout-source", { cache: "no-store" });
      if (check.ok) setPreview(await check.json() as Preview);
    } catch (e) { setError(e instanceof Error ? e.message : "Correction refusee"); }
    finally { setBusy(false); }
  }
  return <section className="mt-4 rounded-xl border border-sky-300 bg-white p-4 text-sm">
    <h4 className="font-semibold">STOCKMAN V25 — Raccordement fournisseur pour le panier</h4>
    <p className="mt-1 text-slate-600">Les gardes de disponibilite du panier utilisent stockman.sourceUrl. Ce correctif renseigne ce champ sur les 45 parents V20, sans prix, stock, publication ni creation de produit. Il ne garantit pas encore l'acces STOCKMAN du serveur de production.</p>
    <button type="button" disabled={busy} onClick={load} className="mt-3 rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-40">{busy ? "Verification..." : "Verifier les 45 URL du panier"}</button>
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
    {result && <p className="mt-2 font-semibold text-emerald-800">{result}</p>}
    {preview && <div className="mt-3 space-y-2">
      <p><b>{preview.total}</b> groupes · <b>{preview.missing}</b> URL à raccorder · <b>{preview.already}</b> déjà correctes · <b>{preview.blocked}</b> bloquées.</p>
      {preview.blocked > 0 && <div role="alert" className="rounded border border-red-300 p-2 text-red-700">{preview.rows.filter(r => r.issues.length).map(r => `${r.title} : ${r.issues.join(", ")}`).join(" ; ")}</div>}
      {preview.blocked === 0 && preview.missing > 0 && <>
        <p>Pour autoriser l'ajout des URL de provenance, saisis exactement <b>{TOKEN}</b> :</p>
        <input className="w-full max-w-xs rounded border p-2" value={confirmation} placeholder={TOKEN} onChange={e => setConfirmation(e.target.value)} />
        <button type="button" className="ml-2 rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-40" disabled={busy || confirmation !== TOKEN} onClick={apply}>Raccorder les URL fournisseur</button>
      </>}
      {preview.blocked === 0 && preview.missing === 0 && <p className="font-semibold text-emerald-800">Les 45 URL sont raccordees. Verification du panier et de la session fournisseur de production encore necessaire avant publication.</p>}
    </div>}
  </section>;
}
