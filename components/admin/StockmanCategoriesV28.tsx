"use client";

import { useState } from "react";

type Category = { id: string; label: string; path: string };
type Family = { family: string; count: number; alreadyClassified: number; remaining: number; blocked: number; suggestion: string; proposedPath: string; status: string };
type Preview = { rootFound: boolean; categoryOptions: Category[]; rows: Family[] };
type Result = { updated: number; details: { family: string; target: string; updated: number; expected: number }[] };

export default function StockmanCategoriesV28() {
  const [data, setData] = useState<Preview | null>(null);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [confirmation, setConfirmation] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function preview() {
    setBusy(true); setError(""); setResult(null); setConfirmation("");
    try {
      const r = await fetch("/api/admin/suppliers/stockman/diables-categories", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setData(d);
      setChoices(Object.fromEntries((d.rows as Family[]).map(row => [row.family, row.suggestion])));
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur de lecture"); }
    finally { setBusy(false); }
  }
  const selected = data?.rows.filter(row => row.remaining && !row.blocked && choices[row.family]) || [];
  const count = selected.reduce((total, row) => total + row.remaining, 0);
  async function apply() {
    if (!data || !count || confirmation !== "CLASSER STOCKMAN V28") return;
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/admin/suppliers/stockman/diables-categories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation, choices: selected.map(row => ({ family: row.family, categoryId: choices[row.family] })) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setResult(d); setData(null); setConfirmation("");
    } catch (e) { setError(e instanceof Error ? e.message : "Echec du classement"); }
    finally { setBusy(false); }
  }
  return <section className="my-5 space-y-3 rounded-xl border border-teal-300 bg-white p-4 text-sm">
    <h3 className="font-bold text-base">STOCKMAN V28 — Classer les 45 produits dans les catégories OYSTE</h3>
    <p>Correspondances avec la hiérarchie OYSTE existante. Aucune création de catégorie et aucune modification de description, image, PDF, prix, stock ou statut de publication. Les choix incertains ne sont pas présélectionnés.</p>
    <button type="button" className="rounded bg-slate-900 px-4 py-2 font-bold text-white disabled:opacity-50" disabled={busy} onClick={preview}>{busy ? "Lecture…" : "Prévisualiser les catégories dans Neon"}</button>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {data && <>
      <p className="font-semibold">{data.rows.reduce((n,r) => n+r.count,0)} produits · {data.rows.length} sous-familles · {count} produits sélectionnés pour classement</p>
      {!data.rootFound && <p className="font-semibold text-red-700">Racine « Manutention au sol » introuvable ou ambiguë : aucune écriture possible.</p>}
      <div className="max-h-[550px] overflow-auto rounded border"><table className="w-full min-w-[850px] text-left text-xs"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-2">Sous-famille STOCKMAN</th><th className="p-2">Fiches</th><th className="p-2">Catégorie OYSTE à choisir</th><th className="p-2">Contrôle</th></tr></thead><tbody>{data.rows.map(row => <tr className="border-t" key={row.family}>
        <td className="p-2 font-semibold">{row.family}</td><td className="p-2">{row.remaining} à classer / {row.count}</td>
        <td className="p-2"><select aria-label={`Catégorie OYSTE pour ${row.family}`} className="w-full max-w-xl rounded border p-2" value={choices[row.family] || ""} onChange={e => { setChoices(old => ({...old,[row.family]:e.target.value})); setConfirmation(""); }} disabled={!data.rootFound || !row.remaining || Boolean(row.blocked)}>
          <option value="">— Laisser à vérifier —</option>{data.categoryOptions.map(c => <option value={c.id} key={c.id}>{c.label}</option>)}
        </select></td><td className="p-2 text-slate-700">{row.blocked ? `${row.blocked} fiche(s) bloquée(s)` : row.suggestion ? "Correspondance suggérée — à valider" : row.proposedPath === "Choix manuel requis" ? "Choix manuel requis" : "Chemin absent de Neon — choisir une catégorie existante"}</td>
      </tr>)}</tbody></table></div>
      <p className="text-amber-800">Vérifie les catégories proposées, surtout « Tracteurs pousseurs électriques ». Tu peux laisser des sous-familles sans choix : aucune fiche correspondante ne sera modifiée.</p>
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3"><label htmlFor="stockman-v28-confirm" className="font-semibold">Pour classer les {count} fiches sélectionnées, saisis CLASSER STOCKMAN V28 :</label><input id="stockman-v28-confirm" className="mt-2 block w-full max-w-sm rounded border p-2" placeholder="CLASSER STOCKMAN V28" value={confirmation} onChange={e => setConfirmation(e.target.value)}/>
      <button type="button" className="mt-2 rounded bg-teal-700 px-4 py-2 font-bold text-white disabled:opacity-40" disabled={busy || !data.rootFound || !count || confirmation !== "CLASSER STOCKMAN V28"} onClick={apply}>Rattacher les {count} fiches sélectionnées (DRAFT)</button></div>
    </>}
    {result && <div className="rounded bg-slate-100 p-3"><p className="font-semibold">{result.updated} produit(s) classé(s) dans Neon. Aucun produit publié.</p>{result.details.map(d => <p key={d.family}>{d.family} : {d.updated}/{d.expected} → {d.target}</p>)}</div>}
  </section>;
}
