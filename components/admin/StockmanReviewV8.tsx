"use client";

import { useMemo, useState } from "react";

type ReviewState = "BLOQUE" | "CONTROLE_CIBLE" | "PRET_DOCUMENTAIRE_NON_PUBLIABLE";
type ReviewRow = {
  reference: string; designation: string; famille: string; sous_famille: string;
  classification_proposee: string; etat: ReviewState; alertes: string;
  url_source: string; pdf: string; prix_achat: string; stock: string;
};
type Warning = { type: string; famille: string; details: string };
type Manifest = {
  version: number; mode: string; writesAuthorized: boolean; publicationAuthorized: boolean;
  commercialDataIncluded: boolean; reviewRows: ReviewRow[]; groupWarnings: Warning[];
};
const states: ReviewState[] = ["BLOQUE", "CONTROLE_CIBLE", "PRET_DOCUMENTAIRE_NON_PUBLIABLE"];
const labelState: Record<ReviewState,string> = {
  BLOQUE: "Bloquée", CONTROLE_CIBLE: "Contrôle ciblé", PRET_DOCUMENTAIRE_NON_PUBLIABLE: "Prête documentairement (non publiable)"
};
const safe = (text: string) => /^[=+@-]/.test(text.trim()) ? "'" + text : text;
const csv = (text: string) => `"${safe(text).replace(/"/g,'""')}"`;
const allowedUrl = (url: string) => /^https:\/\/www\.stockman\.fr\//i.test(url);
function saveFile(name:string, data:string, mime:string) {
  const url=URL.createObjectURL(new Blob([data],{type:mime}));
  const a=document.createElement("a"); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function parseManifest(raw: unknown): Manifest {
  if (!raw || typeof raw !== "object") throw new Error("Format JSON incorrect.");
  const m = raw as Manifest;
  if (m.version !== 8 || m.mode !== "DOCUMENTARY_REVIEW_ONLY" || m.writesAuthorized !== false || m.publicationAuthorized !== false || m.commercialDataIncluded !== false || !Array.isArray(m.reviewRows) || !Array.isArray(m.groupWarnings)) throw new Error("Sélectionner plan-documentaire.json du dossier V8 (lecture seule). ");
  if (m.reviewRows.length > 2000) throw new Error("Manifeste trop volumineux.");
  const refs=new Set<string>();
  for (const r of m.reviewRows) {
    if (!r || typeof r.reference !== "string" || !r.reference.trim() || !states.includes(r.etat) || typeof r.sous_famille !== "string" || typeof r.famille !== "string" || typeof r.designation !== "string" || typeof r.alertes !== "string") throw new Error("Ligne du manifeste invalide.");
    const key=r.reference.trim().toUpperCase(); if (refs.has(key)) throw new Error("Référence dupliquée : " + key); refs.add(key);
  }
  return m;
}
export default function StockmanReviewV8() {
  const [manifest,setManifest]=useState<Manifest|null>(null);
  const [name,setName]=useState("");
  const [error,setError]=useState("");
  const [state,setState]=useState("ALL");
  const [subcat,setSubcat]=useState("ALL");
  const [search,setSearch]=useState("");
  const summary=useMemo(()=>({
    blocked:manifest?.reviewRows.filter(r=>r.etat==="BLOQUE").length || 0,
    review:manifest?.reviewRows.filter(r=>r.etat==="CONTROLE_CIBLE").length || 0,
    ready:manifest?.reviewRows.filter(r=>r.etat==="PRET_DOCUMENTAIRE_NON_PUBLIABLE").length || 0
  }),[manifest]);
  const categories=useMemo(()=>[...new Set((manifest?.reviewRows || []).map(r=>r.sous_famille))].sort((a,b)=>a.localeCompare(b,"fr")),[manifest]);
  const rows=useMemo(()=> (manifest?.reviewRows || []).filter(r=>(state==="ALL" || r.etat===state) && (subcat==="ALL" || r.sous_famille===subcat) && (r.reference+" "+r.designation+" "+r.famille).toLowerCase().includes(search.toLowerCase())),[manifest,state,subcat,search]);
  async function openFile(file?:File) {
    if(!file) return; setError(""); setManifest(null); setName("");
    try { if(file.size>15*1024*1024) throw new Error("Fichier trop volumineux."); const m=parseManifest(JSON.parse(await file.text())); setManifest(m); setName(file.name); }
    catch(e){setError(e instanceof Error?e.message:"Chargement impossible");}
  }
  const exportExceptions=()=>{
    if(!manifest) return;
    const items=manifest.reviewRows.filter(r=>r.etat!=="PRET_DOCUMENTAIRE_NON_PUBLIABLE");
    const cols=["Référence","Désignation","Famille","Sous-famille","État","Alertes","Classification","Lien source","PDF"];
    const body=items.map(r=>[r.reference,r.designation,r.famille,r.sous_famille,labelState[r.etat],r.alertes,r.classification_proposee,allowedUrl(r.url_source)?r.url_source:"",allowedUrl(r.pdf)?r.pdf:""]);
    saveFile("OYSTE-STOCKMAN-V8-EXCEPTIONS.csv","\uFEFF"+[cols,...body].map(row=>row.map(v=>csv(String(v))).join(";")).join("\r\n"),"text/csv;charset=utf-8");
  };
  return <section className="mt-4 rounded-xl border border-cyan-300 bg-white p-4 text-sm">
    <h3 className="font-black text-slate-900">Contrôle documentaire V8 — lecture seule</h3>
    <p className="mt-1 text-xs text-slate-600">Charge le fichier <strong>plan-documentaire.json</strong> du ZIP de validation V8. Il reste local dans ton navigateur. Aucun import, aucune publication, aucune modification des prix ou stocks.</p>
    <input type="file" accept=".json,application/json" aria-label="Charger le plan documentaire V8" onChange={e=>void openFile(e.target.files?.[0])} className="mt-3 block max-w-full text-xs" />
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
    {manifest && <>
      <p className="mt-2 text-xs text-slate-600">{name} · {manifest.reviewRows.length} références · les statuts sont des contrôles documentaires et non des autorisations de publication.</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {([["Bloquées",summary.blocked,"bg-red-50"],["Contrôles ciblés",summary.review,"bg-amber-50"],["Préparées · non publiables",summary.ready,"bg-slate-100"]] as const).map(([label,n,bg])=><div key={label} className={`rounded-lg p-3 ${bg}`}><p className="text-xl font-black">{n}</p><p className="text-xs">{label}</p></div>)}
      </div>
      <p className="mt-2 text-xs font-semibold text-amber-800">Prix d’achat et stock absents de cet export. Une référence prête documentairement ne peut pas être commandée sans validation commerciale.</p>
      <div className="mt-3 flex flex-wrap gap-2 items-center">
        <select aria-label="Filtrer les états V8" value={state} onChange={e=>setState(e.target.value)} className="rounded border p-2 text-xs"><option value="ALL">Tous les états</option>{states.map(s=><option value={s} key={s}>{labelState[s]}</option>)}</select>
        <select aria-label="Filtrer les sous-catégories V8" value={subcat} onChange={e=>setSubcat(e.target.value)} className="rounded border p-2 text-xs"><option value="ALL">Toutes les sous-familles</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select>
        <input aria-label="Rechercher une référence V8" placeholder="Référence ou produit" value={search} onChange={e=>setSearch(e.target.value)} className="rounded border p-2 text-xs" />
        <button type="button" className="rounded-lg bg-cyan-800 px-3 py-2 font-bold text-white text-xs" onClick={exportExceptions}>Exporter les exceptions (CSV)</button>
      </div>
      {manifest.groupWarnings.length>0 && <details className="mt-3 rounded border border-amber-200 p-3"><summary className="cursor-pointer font-bold text-xs">Alertes au niveau des familles ({manifest.groupWarnings.length})</summary><ul className="mt-2 space-y-2 text-xs">{manifest.groupWarnings.map((w,i)=><li key={i}><strong>{w.famille}</strong> — {w.details}</li>)}</ul></details>}
      <div className="mt-3 max-h-[430px] overflow-auto rounded border"><table className="w-full min-w-[780px] text-left text-xs"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-2">Référence</th><th className="p-2">Produit</th><th className="p-2">Sous-famille</th><th className="p-2">État</th><th className="p-2">Alerte</th><th className="p-2">Source</th></tr></thead><tbody>{rows.map(r=><tr key={r.reference} className="border-t"><td className="p-2 font-bold">{r.reference}</td><td className="p-2">{r.designation}</td><td className="p-2">{r.sous_famille}</td><td className="p-2">{labelState[r.etat]}</td><td className="p-2">{r.alertes || "—"}</td><td className="p-2">{allowedUrl(r.url_source) ? <a className="underline" href={r.url_source} target="_blank" rel="noreferrer">STOCKMAN</a> : "—"}</td></tr>)}</tbody></table>{rows.length===0 && <p className="p-3 text-xs">Aucune référence pour ce filtre.</p>}</div>
    </>}
  </section>;
}
