"use client";

import { useMemo, useState } from "react";

type Inventory = {
  products: Array<{ id: string; code: string; supplierCode: string | null }>;
  variants: Array<{ id: string; productId: string; code: string; supplierCode: string | null }>;
  index: Array<{ reference: string; productId: string | null; targetId: string | null; targetType: string | null; isActive: boolean }>;
};
type Draft = {
  reference: string;
  designation: string;
  title: string;
  subcategory: string;
  sourceUrl: string;
  statusNeon: string;
  decision: string;
  description: string;
  technicalSections: unknown[];
  pdfs: Array<{ text: string; url: string }>;
};
type Family = {
  key: string;
  title: string;
  subcategory: string;
  sourceUrl: string;
  description: string;
  technicalSections: string[];
  pdfs: Array<{ text: string; url: string }>;
  variants: Array<{ reference: string; designation: string; match: string; status: string }>;
};
const norm = (value: string) => value.trim().toUpperCase().replace(/\s+/g, "");
const plain = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const validUrl = (value: string) => /^https:\/\/www\.stockman\.fr\//i.test(value);
const accessory = (value: string) => /\b(accessoire|option|bac|crochet|support|tapis|cabas|porte.outil|panneau porte.outil|presentoir|pr[eé]sentoir|sangle|housse)\b/i.test(value);
const clean = (value: string) => value.replace(/&(?:amp|nbsp);/gi, " ").replace(/&eacute;/gi, "é").replace(/&agrave;/gi, "à").replace(/&egrave;/gi, "è").replace(/&rsquo;/gi, "’").replace(/&quot;/gi, '"').replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const csvCell = (value: string) => `"${(/^[\s]*[=+@-]/.test(value) ? "'" : "") + value.replace(/"/g, '""')}\"`;
function download(filename: string, payload: string, mime: string) {
  const url = URL.createObjectURL(new Blob([payload], { type: mime }));
  const link = document.createElement("a"); link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}
function parseDrafts(raw: unknown): Family[] {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as {drafts?: unknown}).drafts)) throw new Error("Choisir le JSON des brouillons V6 (champ drafts requis).");
  const payload = raw as { drafts: unknown[] };
  if (payload.drafts.length > 1000) throw new Error("Fichier trop volumineux pour la préparation locale.");
  const byUrl = new Map<string, Family>();
  const refs = new Set<string>();
  for (const entry of payload.drafts) {
    if (!entry || typeof entry !== "object") throw new Error("Brouillon invalide.");
    const d = entry as Record<string, unknown>;
    const ref = plain(d.reference);
    const url = plain(d.sourceUrl);
    if (!ref || !validUrl(url) || refs.has(norm(ref))) throw new Error(`Référence vide, répétée ou URL fournisseur non valide : ${ref}`);
    refs.add(norm(ref));
    if (d.decision !== "PREPARER_POUR_VALIDATION") throw new Error(`Décision non qualifiée : ${ref}`);
    if (!byUrl.has(url)) {
      const pdfs = Array.isArray(d.pdfs) ? d.pdfs.filter((p): p is {text: string; url: string} => !!p && typeof p === "object" && validUrl(plain((p as {url?: unknown}).url))).map(p => ({ text: plain(p.text) || "Fiche technique", url: p.url })) : [];
      byUrl.set(url, { key: url, title: plain(d.title), subcategory: plain(d.subcategory), sourceUrl: url, description: clean(plain(d.description)), technicalSections: Array.isArray(d.technicalSections) ? d.technicalSections.filter((x): x is string => typeof x === "string").map(clean) : [], pdfs, variants: [] });
    }
    const group = byUrl.get(url)!;
    group.variants.push({reference: ref, designation: plain(d.designation), match: plain(d.statusNeon), status: accessory(plain(d.designation)) ? "ACCESSOIRE_A_VERIFIER" : "VARIANTE_A_VERIFIER"});
  }
  return [...byUrl.values()].sort((a,b) => a.subcategory.localeCompare(b.subcategory, "fr") || a.title.localeCompare(b.title, "fr"));
}

export default function StockmanDocumentaryStaging({ inventory }: { inventory: Inventory | null }) {
  const [families, setFamilies] = useState<Family[]>([]);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [classification, setClassification] = useState<Record<string,string>>({});
  const indexed = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const add = (reference: string, target: string) => { const key = norm(reference); if (!key) return; const value = map.get(key) || new Set<string>(); value.add(target); map.set(key,value); };
    for (const p of inventory?.products || []) { add(p.code, `PRODUCT:${p.id}`); if (p.supplierCode) add(p.supplierCode, `PRODUCT:${p.id}`); }
    for (const v of inventory?.variants || []) { add(v.code, `VARIANT:${v.id}`); if (v.supplierCode) add(v.supplierCode, `VARIANT:${v.id}`); }
    return map;
  }, [inventory]);
  const stats = useMemo(() => {
    const all = families.flatMap(f => f.variants);
    return { refs: all.length, suspected: all.filter(v => (classification[norm(v.reference)] || v.status) === "ACCESSOIRE_A_VERIFIER").length,
      existing: all.filter(v => indexed.has(norm(v.reference))).length, groups: families.length, documents: new Set(families.flatMap(f => f.pdfs.map(p => p.url))).size };
  }, [families, indexed, classification]);
  const categories = useMemo(() => [...new Set(families.map(f => f.subcategory))].sort((a,b)=>a.localeCompare(b,"fr")), [families]);
  const shown = families.filter(f => filter === "ALL" || f.subcategory === filter);
  const handleFile = async (file?: File) => {
    if (!file) return;
    setError(""); setFamilies([]); setFilename(""); setClassification({});
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("Fichier supérieur à 20 Mo.");
      const parsed = parseDrafts(JSON.parse(await file.text()));
      setFamilies(parsed); setFilename(file.name);
    } catch(e) { setError(e instanceof Error ? e.message : "Fichier incorrect."); }
  };
  const exportPlan = () => {
    const rows = [["Famille","Sous-famille","Référence","Désignation","Qualification proposée","Présence produit/variante Neon","PDF source","Action","Page source"]];
    for (const f of families) for (const v of f.variants) rows.push([f.title,f.subcategory,v.reference,v.designation,classification[norm(v.reference)] || v.status,
      !inventory ? "NON VERIFIE" : indexed.has(norm(v.reference)) ? "OUI" : "NON CONFIRME", f.pdfs.map(p => p.url).join(" | "),
      indexed.has(norm(v.reference)) ? "VALIDER LE RATTACHEMENT EXISTANT" : "QUALIFIER LE PARENT ET LE PRIX AVANT CREATION", f.sourceUrl]);
    download("OYSTE-STOCKMAN-PLAN-DOCUMENTAIRE.csv", "\uFEFF" + rows.map(row=>row.map(csvCell).join(";")).join("\r\n"),"text/csv;charset=utf-8");
  };
  const exportGrouped = () => {
    download("OYSTE-STOCKMAN-GROUPES-VALIDATION.json", JSON.stringify({version:1,mode:"REVIEW_ONLY",writesAuthorized:false,commercialDataIncluded:false,reviewRequired:true,createdAt:new Date().toISOString(),families:families.map(f=>({...f,variants:f.variants.map(v=>({...v,classification:classification[norm(v.reference)] || v.status,existingNeon:inventory ? indexed.has(norm(v.reference)) : null}))}))},null,2), "application/json;charset=utf-8");
  };
  return <div className="mt-4 rounded-xl border border-cyan-300 bg-white p-4 text-sm">
    <h3 className="font-black text-slate-900">Pré-import documentaire par fiche fournisseur — lecture seule</h3>
    <p className="mt-1 text-xs text-slate-600">Charge le fichier OYSTE-STOCKMAN-BROUILLONS JSON exporté en V6. Regroupement par page source : ne crée pas 92 produits indépendants. Prix, stocks, catégories publiées et produits Neon inchangés.</p>
    <input type="file" accept=".json,application/json" aria-label="Charger les brouillons V6" onChange={e=>void handleFile(e.target.files?.[0])} className="mt-3 block max-w-full text-xs" />
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
    {families.length > 0 && <>
      <p className="mt-2 text-xs text-slate-600">{filename} · {inventory ? "Inventaire Neon disponible" : "Inventaire Neon non chargé : aucun rattachement certifiable"}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-5">{[["Fiches parentes",stats.groups],["Références",stats.refs],["Accessoires suspectés",stats.suspected],["PDF distincts",stats.documents],["Produits/variantes trouvés",inventory ? stats.existing : "?"]].map(([label,num])=><div key={label} className="rounded-lg bg-slate-100 p-3"><p className="text-xl font-black">{num}</p><p className="text-xs">{label}</p></div>)}</div>
      <p className="mt-3 text-xs font-semibold text-amber-800">Les accessoires sont détectés par mots-clés, à confirmer. « Indexé seulement » ne constitue pas un produit Neon. Aucun import ni publication autorisé depuis cet écran.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" className="rounded-lg border border-cyan-800 px-3 py-2 text-xs font-bold" onClick={exportPlan}>Exporter le plan CSV</button><button type="button" className="rounded-lg bg-cyan-800 px-3 py-2 text-xs font-bold text-white" onClick={exportGrouped}>Exporter les groupes pour validation (JSON)</button><select aria-label="Filtrer les sous-familles documentaires" value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-lg border p-2 text-xs"><option value="ALL">Toutes les sous-familles</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
      <div className="mt-3 max-h-[440px] overflow-auto rounded-lg border">{shown.map(f=><details key={f.key} className="border-b p-3"><summary className="cursor-pointer font-bold">{f.title} — {f.variants.length} référence(s) · {f.pdfs.length} PDF</summary><p className="mt-2 text-xs text-slate-600">{f.subcategory} · Description : {f.description ? "présente" : "absente"} · {f.technicalSections.length} zone(s) technique(s)</p><table className="mt-2 w-full text-left text-xs"><thead><tr><th className="p-1">Référence</th><th className="p-1">Désignation</th><th className="p-1">Qualification</th></tr></thead><tbody>{f.variants.map(v=><tr key={v.reference} className="border-t"><td className="p-1 font-bold">{v.reference}</td><td className="p-1">{v.designation}</td><td className="p-1"><select aria-label={`Type de ${v.reference}`} value={classification[norm(v.reference)] || v.status} onChange={e=>setClassification(previous=>({...previous,[norm(v.reference)]:e.target.value}))} className="max-w-[190px] rounded border p-1"><option value="VARIANTE_A_VERIFIER">Variante à vérifier</option><option value="ACCESSOIRE_A_VERIFIER">Accessoire à vérifier</option><option value="PRODUIT_SEPARE_A_VERIFIER">Produit séparé à vérifier</option><option value="EXCLURE">Ne pas intégrer</option></select></td></tr>)}</tbody></table></details>)}</div>
    </>}
  </div>;
}
