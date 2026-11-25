"use client";
import { useState } from "react";

type Row = { reference: string; match: string; purchasePriceHt: number | null; priceOrigin: string; draftStock: number | null; draftReadAt: string | null; availability: {status: string; stock: number | null; checkedAt: string | null}; needsReview: boolean; publicationStatus: string | null };
type Result = { checkedAt: string; rows: Row[] };
const euro = (value: number | null) => value === null ? "Non renseigne" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
export default function StockmanCommercialV10() {
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [onlyIssues, setOnlyIssues] = useState(false);
  async function loadFile(file: File | undefined) {
    if (!file) return;
    setBusy(true); setError(""); setResult(null);
    try {
      if (file.size > 5_000_000) throw new Error("Fichier trop volumineux");
      const parsed: unknown = JSON.parse(await file.text());
      const families = parsed && typeof parsed === "object" && "families" in parsed ? (parsed as {families?: unknown}).families : null;
      if (!Array.isArray(families)) throw new Error("Charge le fichier OYSTE-STOCKMAN-GROUPES-VALIDATION.json (V7)");
      const refs: string[] = [];
      for (const family of families) {
        if (!family || typeof family !== "object") continue;
        const variants = (family as { variants?: unknown }).variants;
        if (!Array.isArray(variants)) continue;
        for (const item of variants) {
          if (item && typeof item === "object" && typeof (item as {reference?: unknown}).reference === "string") refs.push((item as {reference: string}).reference.trim().toUpperCase());
        }
      }
      const references = [...new Set(refs)];
      if (!references.length) throw new Error("Aucune reference valide");
      const response = await fetch("/api/admin/suppliers/stockman/commercial-inventory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ references }), cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Neon indisponible");
      setResult(data as Result);
    } catch(e) { setError(e instanceof Error ? e.message : "Erreur de lecture"); }
    finally { setBusy(false); }
  }
  const rows = result?.rows ?? [];
  const visible = (onlyIssues ? rows.filter(r => r.needsReview) : rows).slice(0,250);
  return <section className="mt-4 rounded-xl border border-cyan-300 bg-white p-4">
    <h4 className="text-sm font-black">Controle commercial STOCKMAN V10 — lecture seule</h4>
    <p className="mt-1 text-xs text-slate-600">Charge le plan de groupes V7. Seules les references sont envoyees a l'API admin ; descriptions, PDF et donnees privees restent dans ton navigateur. Aucune ecriture dans Neon.</p>
    <label className="mt-3 block text-xs font-semibold">Plan de groupes V7 (JSON) <input type="file" accept=".json,application/json" onChange={e => void loadFile(e.target.files?.[0])} className="mt-1 block text-xs" /></label>
    {busy ? <p className="mt-2 text-xs">Consultation de Neon...</p> : null}
    {error ? <p role="alert" className="mt-2 text-xs text-red-700">{error}</p> : null}
    {result ? <>
      <p className="mt-3 text-xs text-slate-600">{rows.length} references • lecture Neon : {new Date(result.checkedAt).toLocaleString("fr-FR")}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">{[
        ["Prix d'achat retrouves", rows.filter(r=>r.purchasePriceHt !== null).length],
        ["Prix d'achat absents", rows.filter(r=>r.purchasePriceHt === null).length],
        ["Stocks fournisseurs recents", rows.filter(r=>r.availability.status === "known").length],
        ["Sans stock confirme", rows.filter(r=>r.availability.status !== "known").length],
      ].map(([name,n])=><div key={name} className="rounded-lg bg-slate-50 p-3"><strong className="text-xl">{n}</strong><p className="text-xs">{name}</p></div>)}</div>
      <label className="mt-3 flex items-center gap-2 text-xs"><input type="checkbox" checked={onlyIssues} onChange={e=>setOnlyIssues(e.target.checked)} /> Afficher uniquement les lignes a verifier</label>
      <p className="mt-2 text-xs text-amber-800">Les prix issus des brouillons sont historiques, non certifies actuels. Le stock du brouillon n'est jamais considere comme une disponibilite actuelle. Transport inclus selon ta regle STOCKMAN, sans modification du panier.</p>
      <div className="mt-2 max-h-96 overflow-auto border rounded-lg"><table className="w-full min-w-[850px] text-left text-xs"><thead className="sticky top-0 bg-slate-100"><tr>{["Reference","Etat Neon","PA HT","Source prix","Stock fournisseur","Date releve","Publication"].map(t=><th key={t} className="p-2">{t}</th>)}</tr></thead><tbody>{visible.map(r=><tr key={r.reference} className="border-t"><td className="p-2 font-bold">{r.reference}</td><td className="p-2">{r.match}</td><td className="p-2">{euro(r.purchasePriceHt)}</td><td className="p-2">{r.priceOrigin}</td><td className="p-2">{r.availability.status === "known" ? r.availability.stock : "A confirmer"}</td><td className="p-2">{r.availability.checkedAt ? new Date(r.availability.checkedAt).toLocaleString("fr-FR") : "-"}</td><td className="p-2">{r.publicationStatus ?? "Sans fiche"}</td></tr>)}</tbody></table></div>
    </> : null}
  </section>;
}
