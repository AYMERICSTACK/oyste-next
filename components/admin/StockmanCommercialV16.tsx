"use client";

import { useMemo, useState } from "react";

type CommercialRow = {
  reference: string;
  designation: string;
  famille: string;
  sousFamille: string;
  etatDocumentaire: "BLOQUE" | "CONTROLE_CIBLE" | "PRET_DOCUMENTAIRE_NON_PUBLIABLE";
  prixAchatHT: number | null;
  stockNumerique: number | null;
  stockBrut: string | null;
  captureAt: string | null;
  anomalies: string[];
  publicationAutorisee: false;
  transportInclus: true;
};
type ImportV15 = {
  version: 15;
  mode: "READ_ONLY_LOCAL";
  publicationAuthorized: false;
  writesAuthorized: false;
  totaux: { referencesAttendues: number; referencesScannees: number; referencesHorsSelection: number; avecPrixHT: number; avecStockNumerique: number; bloquees: number; controlesCibles: number; pretesDocumentairement: number };
  horsSelection: string[];
  rows: CommercialRow[];
  sourceV14?: string;
};
const normalized = (s: string) => s.trim().toUpperCase();
const asObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const money = (v: number | null) => v === null ? "À compléter" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);
const validCount = (n: unknown) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
function readV15(raw: unknown): ImportV15 {
  if (!asObject(raw) || raw.version !== 15 || raw.mode !== "READ_ONLY_LOCAL" || raw.publicationAuthorized !== false || raw.writesAuthorized !== false || !Array.isArray(raw.rows) || !asObject(raw.totaux)) throw new Error("Ce fichier n'est pas le rapprochement commercial privé V15 attendu.");
  if (raw.rows.length !== 92) throw new Error("Le fichier V15 doit contenir exactement 92 références.");
  if (!Array.isArray(raw.horsSelection) || raw.horsSelection.length !== 2 || raw.horsSelection.some(v => typeof v !== "string")) throw new Error("Les deux références hors sélection ne sont pas identifiées.");
  const seen = new Set<string>();
  for (const row of raw.rows as unknown[]) {
    if (!asObject(row) || typeof row.reference !== "string" || !row.reference.trim() || seen.has(normalized(row.reference))) throw new Error("Référence manquante ou en double dans V15.");
    seen.add(normalized(row.reference));
    if (typeof row.designation !== "string" || typeof row.famille !== "string" || typeof row.sousFamille !== "string" || !["BLOQUE", "CONTROLE_CIBLE", "PRET_DOCUMENTAIRE_NON_PUBLIABLE"].includes(String(row.etatDocumentaire)) || !Array.isArray(row.anomalies) || !row.anomalies.every(x => typeof x === "string") || row.publicationAutorisee !== false || row.transportInclus !== true) throw new Error(`Données documentaires invalides pour ${row.reference}.`);
    if (row.prixAchatHT !== null && (typeof row.prixAchatHT !== "number" || !Number.isFinite(row.prixAchatHT) || row.prixAchatHT < 0)) throw new Error(`Prix invalide pour ${row.reference}.`);
    if (row.stockNumerique !== null && !validCount(row.stockNumerique)) throw new Error(`Stock invalide pour ${row.reference}.`);
    if (row.captureAt !== null && (typeof row.captureAt !== "string" || !Number.isFinite(Date.parse(row.captureAt)))) throw new Error(`Date du relevé invalide pour ${row.reference}.`);
  }
  if (raw.horsSelection.some(v => seen.has(normalized(v as string)))) throw new Error("Une référence hors sélection figure dans les 92 lignes.");
  const rows = raw.rows as CommercialRow[];
  const totals = raw.totaux;
  const checks: Array<[string, number]> = [
    ["referencesAttendues",92], ["referencesHorsSelection",2],
    ["avecPrixHT",rows.filter(r=>r.prixAchatHT!==null).length],
    ["avecStockNumerique",rows.filter(r=>r.stockNumerique!==null).length],
    ["bloquees",rows.filter(r=>r.etatDocumentaire==="BLOQUE").length],
    ["controlesCibles",rows.filter(r=>r.etatDocumentaire==="CONTROLE_CIBLE").length],
    ["pretesDocumentairement",rows.filter(r=>r.etatDocumentaire==="PRET_DOCUMENTAIRE_NON_PUBLIABLE").length],
  ];
  for (const [key,count] of checks) if (totals[key] !== count) throw new Error(`Incohérence du bilan V15 : ${key}.`);
  if (totals.referencesScannees !== 94) throw new Error("Le nombre de références scannées V14 est inattendu.");
  return raw as ImportV15;
}
export default function StockmanCommercialV16() {
  const [fileData, setFileData] = useState<ImportV15 | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [showAmounts, setShowAmounts] = useState(false);
  const rows = useMemo(() => fileData?.rows ?? [], [fileData]);
  const filtered = useMemo(() => rows.filter(r => {
    const q = query.trim().toLocaleLowerCase("fr-FR");
    const matchesSearch = !q || [r.reference,r.designation,r.famille,r.sousFamille].some(s=>s.toLocaleLowerCase("fr-FR").includes(q));
    const matchesFilter = filter === "ALL" || (filter === "NO_PRICE" && r.prixAchatHT === null) || (filter === "NO_STOCK" && r.stockNumerique === null) || (filter === "BLOCKED" && r.etatDocumentaire === "BLOQUE") || (filter === "REVIEW" && r.etatDocumentaire === "CONTROLE_CIBLE") || (filter === "READY" && r.etatDocumentaire === "PRET_DOCUMENTAIRE_NON_PUBLIABLE");
    return matchesSearch && matchesFilter;
  }), [rows, query, filter]);
  async function onFile(file?: File) {
    setFileData(null); setError(""); setName(""); setQuery(""); setFilter("ALL"); setShowAmounts(false);
    if (!file) return;
    try {
      if (file.size > 8_000_000) throw new Error("Fichier trop volumineux (8 Mo maximum).");
      const parsed: unknown = JSON.parse(await file.text());
      const validated = readV15(parsed);
      setFileData(validated);setName(file.name);
    } catch (e) {setError(e instanceof Error ? e.message : "Lecture impossible.");}
  }
  const count = (fn: (r: CommercialRow) => boolean) => rows.filter(fn).length;
  return <section className="mt-4 rounded-xl border border-emerald-300 bg-white p-4">
    <h4 className="text-sm font-black text-slate-950">Rapprochement commercial V16 — lecture locale du fichier V15</h4>
    <p className="mt-1 text-xs text-slate-600">Choisis <strong>RAPPROCHEMENT-COMMERCIAL-PRIVE-V15.json</strong> depuis le dossier OYSTE-STOCKMAN-DIABLES-LIVE sur ton Bureau. Analyse uniquement dans cet onglet : aucun envoi à une API, aucune écriture Neon, aucun changement de prix de vente ni publication.</p>
    <label className="mt-3 block text-xs font-semibold text-slate-800">Fichier privé V15 (JSON)
      <input className="mt-1 block max-w-full text-xs" type="file" accept=".json,application/json" onChange={e=>void onFile(e.currentTarget.files?.[0])}/>
    </label>
    {error ? <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{error}</p> : null}
    {fileData ? <>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600"><span>Fichier chargé : <strong>{name}</strong></span><button type="button" className="rounded border px-2 py-1" onClick={()=>{setFileData(null);setName("");setShowAmounts(false);}}>Effacer les données de l'écran</button></div>
      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-6">{[
        ["Références retenues",rows.length], ["Prix HT relevés",count(r=>r.prixAchatHT!==null)], ["Stocks numériques",count(r=>r.stockNumerique!==null)], ["Sans prix",count(r=>r.prixAchatHT===null)], ["Contrôles ciblés",count(r=>r.etatDocumentaire==="CONTROLE_CIBLE")], ["Bloquées",count(r=>r.etatDocumentaire==="BLOQUE")]
      ].map(([label,value])=><div key={String(label)} className="rounded-lg bg-slate-50 p-3"><strong className="text-xl">{value}</strong><p className="text-xs text-slate-600">{label}</p></div>)}</div>
      <p className="mt-3 text-xs text-amber-800">Prix d'achat HT fournisseurs <strong>à valider</strong>. Transport inclus : ne pas le facturer deux fois. Un stock numérique n'est pas une réservation ; une valeur absente n'est pas un stock à zéro. Toutes les fiches restent NON PUBLIABLES.</p>
      <p className="mt-1 text-xs text-slate-600">Hors sélection ({fileData.horsSelection.length}) : {fileData.horsSelection.join(", ")} — jamais incluses dans les 92 lignes.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input className="rounded-lg border p-2 text-xs" placeholder="Chercher une référence ou famille" aria-label="Recherche commerciale V16" value={query} onChange={e=>setQuery(e.target.value)}/>
        <select className="rounded-lg border p-2 text-xs" aria-label="Filtrer le tableau commercial V16" value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="ALL">Toutes les références</option><option value="NO_PRICE">Sans prix HT</option><option value="NO_STOCK">Sans stock numérique</option><option value="BLOCKED">Bloquées</option><option value="REVIEW">Contrôles ciblés</option><option value="READY">Préparées documentairement</option>
        </select>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={showAmounts} onChange={e=>setShowAmounts(e.target.checked)}/>Afficher les montants confidentiels à l'écran</label>
      </div>
      <p className="mt-2 text-xs text-slate-600">{filtered.length} ligne(s) affichée(s) sur {rows.length} • relevé commercial : {fileData.sourceV14 ? new Date(fileData.sourceV14).toLocaleString("fr-FR") : "date non disponible"}</p>
      <div className="mt-2 max-h-[460px] overflow-auto rounded-lg border"><table className="w-full min-w-[1000px] text-left text-xs"><thead className="sticky top-0 bg-slate-100"><tr>{["Référence","Désignation","Famille","PA HT fournisseur","Stock fournisseur","Date du relevé","État documentaire","Anomalies"].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{filtered.map(r=><tr key={r.reference} className="border-t align-top"><td className="p-2 font-bold">{r.reference}</td><td className="p-2">{r.designation}</td><td className="p-2">{r.sousFamille || r.famille}</td><td className="p-2">{r.prixAchatHT===null?"À compléter":showAmounts?money(r.prixAchatHT):"Prix relevé (masqué)"}</td><td className="p-2">{r.stockNumerique===null?"À confirmer":showAmounts?String(r.stockNumerique):"Stock numérique relevé"}</td><td className="p-2">{r.captureAt?new Date(r.captureAt).toLocaleString("fr-FR"):"Non renseigné"}</td><td className="p-2">{r.etatDocumentaire==="BLOQUE"?"BLOQUÉ":r.etatDocumentaire==="CONTROLE_CIBLE"?"Contrôle ciblé":"Préparé (non publiable)"}</td><td className="p-2">{r.anomalies.join(" · ") || "Aucune anomalie déclarée"}</td></tr>)}</tbody></table></div>
    </> : null}
  </section>;
}
