"use client";

import { useMemo, useState } from "react";

type DocRow = { reference: string; etat: string; classification_proposee: string; url_source: string; designation: string };
type DocFamily = { sourceUrl: string; title: string; subcategory: string; variants: Array<{ reference: string }> };
type Documentary = { version: number; mode: string; writesAuthorized: false; publicationAuthorized: false; reviewRows: DocRow[]; families: DocFamily[] };
type CommercialRow = { reference: string; prixAchatHT: number | null; stockNumerique: number | null; etatDocumentaire: string; anomalies: string[]; publicationAutorisee: false; transportInclus: true };
type Commercial = { version: number; mode: string; writesAuthorized: false; publicationAuthorized: false; horsSelection: string[]; rows: CommercialRow[] };
type NeonInventory = {
  version: string;
  checkedAt: string;
  products: Array<{ id: string; code: string; supplierCode: string | null; publicationStatus: string }>;
  variants: Array<{ id: string; code: string; supplierCode: string | null; productId: string }>;
  index: Array<{ reference: string; productId: string | null; targetId: string | null; targetType: string | null; isActive: boolean }>;
};
type Operation = "BLOQUE" | "CONTROLE_CIBLE" | "ACCESSOIRE_A_QUALIFIER" | "DOUBLON_A_RESoudre" | "PRODUIT_EXISTANT_A_RAPPROCHER" | "INDEX_SEUL_A_RAPPROCHER" | "PARENT_A_PREPARER" | "VARIANTE_A_PREPARER";
type Preview = { reference: string; designation: string; famille: string; classification: string; operation: Operation; neon: string; price: boolean; stock: boolean; issues: string[] };
const obj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, "");
const validPrice = (p: unknown): p is number | null => p === null || (typeof p === "number" && Number.isFinite(p) && p >= 0);
const validStock = (s: unknown): s is number | null => s === null || (typeof s === "number" && Number.isSafeInteger(s) && s >= 0);
const asArray = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
function readV8(v: unknown): Documentary {
  if (!obj(v) || v.version !== 8 || v.mode !== "DOCUMENTARY_REVIEW_ONLY" || v.writesAuthorized !== false || v.publicationAuthorized !== false || !Array.isArray(v.reviewRows) || v.reviewRows.length !== 92 || !Array.isArray(v.families) || v.families.length !== 47) throw Error("Plan documentaire V8 invalide (47 familles / 92 références attendues).");
  const refs = new Set<string>();
  for (const x of v.reviewRows) {
    if (!obj(x) || typeof x.reference !== "string" || typeof x.url_source !== "string" || typeof x.designation !== "string" || typeof x.classification_proposee !== "string" || !["BLOQUE", "CONTROLE_CIBLE", "PRET_DOCUMENTAIRE_NON_PUBLIABLE"].includes(String(x.etat))) throw Error("Ligne documentaire V8 invalide.");
    const key = norm(x.reference); if (!key || refs.has(key)) throw Error("Référence V8 absente ou doublonnée."); refs.add(key);
  }
  const urls = new Set<string>();
  for (const f of v.families) {
    if (!obj(f) || typeof f.sourceUrl !== "string" || !f.sourceUrl || typeof f.title !== "string" || !Array.isArray(f.variants)) throw Error("Groupe parent V8 invalide.");
    if (urls.has(f.sourceUrl)) throw Error("Deux groupes parents partagent la même URL."); urls.add(f.sourceUrl);
    for (const item of f.variants) if (!obj(item) || typeof item.reference !== "string" || !refs.has(norm(item.reference))) throw Error("Référence de famille non trouvée dans les 92 références.");
  }
  if (v.reviewRows.some(x => !urls.has(x.url_source))) throw Error("Une référence V8 ne possède aucun groupe parent.");
  return v as Documentary;
}
function readV15(v: unknown): Commercial {
  if (!obj(v) || v.version !== 15 || v.mode !== "READ_ONLY_LOCAL" || v.writesAuthorized !== false || v.publicationAuthorized !== false || !Array.isArray(v.rows) || v.rows.length !== 92 || !Array.isArray(v.horsSelection) || v.horsSelection.length !== 2) throw Error("Fichier commercial privé V15 invalide (92 références attendues).");
  const refs = new Set<string>();
  for (const x of v.rows) {
    if (!obj(x) || typeof x.reference !== "string" || !x.reference.trim() || refs.has(norm(x.reference)) || !validPrice(x.prixAchatHT) || !validStock(x.stockNumerique) || x.transportInclus !== true || x.publicationAutorisee !== false || !Array.isArray(x.anomalies) || !x.anomalies.every((a: unknown) => typeof a === "string")) throw Error("Ligne commerciale V15 incorrecte ou dupliquée.");
    refs.add(norm(x.reference));
  }
  if (v.horsSelection.some(x => typeof x !== "string" || refs.has(norm(x)))) throw Error("Référence hors sélection mélangée aux 92 lignes.");
  return v as Commercial;
}
function makePreview(doc: Documentary, commercial: Commercial, inv: NeonInventory): { rows: Preview[]; families: number } {
  const commercialByRef = new Map(commercial.rows.map(x => [norm(x.reference), x]));
  const docByRef = new Map(doc.reviewRows.map(x => [norm(x.reference), x]));
  if (docByRef.size !== commercialByRef.size || [...docByRef.keys()].some(ref => !commercialByRef.has(ref))) throw Error("Les références V8 et V15 ne correspondent pas exactement.");
  for (const d of doc.reviewRows) if (commercialByRef.get(norm(d.reference))?.etatDocumentaire !== d.etat) throw Error(`Statut documentaire V8/V15 différent : ${d.reference}`);
  const matching = new Map<string, Set<string>>();
  const indexed = new Set<string>();
  const activeProducts = new Set(inv.products.map(p => p.id));
  const activeVariants = new Set(inv.variants.map(v => v.id));
  const insert = (ref: string | null | undefined, id: string) => { const key = norm(ref || ""); if (!key) return; const set = matching.get(key) || new Set<string>(); set.add(id); matching.set(key, set); };
  for (const p of inv.products) { insert(p.code, `P:${p.id}`); insert(p.supplierCode, `P:${p.id}`); }
  for (const v of inv.variants) { insert(v.code, `V:${v.id}`); insert(v.supplierCode, `V:${v.id}`); }
  for (const item of inv.index) {
    if (!item.isActive) continue;
    const key = norm(item.reference); indexed.add(key);
    if (item.productId && activeProducts.has(item.productId)) insert(item.reference, `P:${item.productId}`);
    if (item.targetType?.toLowerCase() === "product" && item.targetId && activeProducts.has(item.targetId)) insert(item.reference, `P:${item.targetId}`);
    if (item.targetType?.toLowerCase() === "variant" && item.targetId && activeVariants.has(item.targetId)) insert(item.reference, `V:${item.targetId}`);
  }
  const families = new Map(doc.families.map(f => [f.sourceUrl, f]));
  const usedParents = new Set<string>();
  const rows: Preview[] = [];
  for (const d of doc.reviewRows) {
    const c = commercialByRef.get(norm(d.reference))!;
    const f = families.get(d.url_source)!;
    const matches = matching.get(norm(d.reference));
    const neon = (matches?.size || 0) > 1 ? "PLUSIEURS_CORRESPONDANCES" : matches?.size ? "PRODUIT_OU_VARIANTE" : indexed.has(norm(d.reference)) ? "INDEX_SEUL" : "ABSENT";
    const issues = [...c.anomalies];
    if (c.prixAchatHT === null && !issues.includes("PRIX_HT_ABSENT")) issues.push("PRIX_HT_ABSENT");
    if (c.stockNumerique === null && !issues.includes("STOCK_A_CONFIRMER")) issues.push("STOCK_A_CONFIRMER");
    const accessory = d.classification_proposee.includes("ACCESSOIRE");
    let operation: Operation;
    if (d.etat === "BLOQUE") operation = "BLOQUE";
    else if (d.etat === "CONTROLE_CIBLE" || c.prixAchatHT === null) operation = "CONTROLE_CIBLE";
    else if ((matches?.size || 0) > 1) operation = "DOUBLON_A_RESoudre";
    else if (accessory) operation = "ACCESSOIRE_A_QUALIFIER";
    else if ((matches?.size || 0) === 1) operation = "PRODUIT_EXISTANT_A_RAPPROCHER";
    else if (neon === "INDEX_SEUL") operation = "INDEX_SEUL_A_RAPPROCHER";
    else if (!usedParents.has(f.sourceUrl)) operation = "PARENT_A_PREPARER";
    else operation = "VARIANTE_A_PREPARER";
    if (!accessory && d.etat === "PRET_DOCUMENTAIRE_NON_PUBLIABLE") usedParents.add(f.sourceUrl);
    rows.push({ reference: d.reference, designation: d.designation, famille: f.title, classification: d.classification_proposee, operation, neon, price: c.prixAchatHT !== null, stock: c.stockNumerique !== null, issues });
  }
  return { rows, families: doc.families.length };
}
const exportJson = (filename: string, data: unknown) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
};
export default function StockmanImportPreviewV17() {
  const [documentary, setDocumentary] = useState<Documentary | null>(null);
  const [commercial, setCommercial] = useState<Commercial | null>(null);
  const [inventory, setInventory] = useState<NeonInventory | null>(null);
  const [inventoryError, setInventoryError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const result = useMemo(() => {
    if (!documentary || !commercial || !inventory) return null;
    try { return { ...makePreview(documentary, commercial, inventory), error: "" }; }
    catch (e) { return { rows: [] as Preview[], families: 0, error: e instanceof Error ? e.message : "Rapprochement impossible." }; }
  }, [documentary, commercial, inventory]);
  const filtered = (result?.rows || []).filter(r => (filter === "ALL" || r.operation === filter || (filter === "ISSUES" && r.issues.length > 0)) && (!query || `${r.reference} ${r.designation} ${r.famille}`.toLowerCase().includes(query.toLowerCase())));
  async function load(file: File | undefined, kind: "doc" | "commercial") {
    setError(""); setInventory(null);
    if (kind === "doc") setDocumentary(null); else setCommercial(null);
    if (!file) return;
    try {
      if (file.size > 8_000_000) throw Error("Fichier trop volumineux (8 Mo maximum).");
      const parsed: unknown = JSON.parse(await file.text());
      if (kind === "doc") setDocumentary(readV8(parsed)); else setCommercial(readV15(parsed));
    } catch (e) { setError(e instanceof Error ? e.message : "Fichier JSON invalide."); }
  }
  async function checkNeon() {
    setInventory(null); setInventoryError(""); setLoading(true);
    try {
      const response = await fetch("/api/admin/suppliers/stockman/reference-inventory", { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) {
        const body = await response.text();
        let detail = "";
        try {
          const parsed: unknown = JSON.parse(body);
          if (obj(parsed) && typeof parsed.error === "string") detail = parsed.error;
        } catch { /* A missing Next.js API route may return an HTML 404 page. */ }
        throw Error(`Lecture inventaire Neon impossible (HTTP ${response.status}). ${detail || (response.status === 404 ? "Route absente ou fournisseur STOCKMAN introuvable." : "Voir le journal du serveur.")}`);
      }
      const payload: unknown = await response.json();
      if (!obj(payload) || payload.version !== "STOCKMAN_REFERENCE_INVENTORY_V1" || !Array.isArray(payload.products) || !Array.isArray(payload.variants) || !Array.isArray(payload.index) || typeof payload.checkedAt !== "string") throw Error("Inventaire Neon inattendu ; simulation interrompue.");
      setInventory(payload as NeonInventory);
    } catch (e) { setInventoryError(e instanceof Error ? e.message : "Inventaire inaccessible."); }
    finally { setLoading(false); }
  }
  const operations = useMemo(() => [...new Set((result?.rows || []).map(r=>r.operation))].sort(), [result]);
  return <section className="mt-4 rounded-xl border border-sky-300 bg-white p-4">
    <h4 className="text-sm font-black text-slate-950">Simulation d'import STOCKMAN V17 — aucune écriture Neon</h4>
    <p className="mt-1 text-xs text-slate-600">Charge les deux fichiers locaux V8 et V15. Les prix et stocks ne quittent pas ton navigateur. Seul l'inventaire des références Neon est lu via l'API admin existante. Aucune création, aucune modification, aucune publication.</p>
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      <label className="text-xs font-semibold">1. Plan documentaire V8 (plan-documentaire.json)
        <input type="file" accept=".json,application/json" className="mt-1 block max-w-full text-xs" onChange={e => void load(e.currentTarget.files?.[0], "doc")}/>
        <span className="mt-1 block font-normal text-slate-600">{documentary ? "47 familles / 92 références vérifiées" : "Non chargé"}</span>
      </label>
      <label className="text-xs font-semibold">2. Rapprochement commercial privé V15 (JSON)
        <input type="file" accept=".json,application/json" className="mt-1 block max-w-full text-xs" onChange={e => void load(e.currentTarget.files?.[0], "commercial")}/>
        <span className="mt-1 block font-normal text-slate-600">{commercial ? "92 références vérifiées, montants masqués" : "Non chargé"}</span>
      </label>
    </div>
    {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" disabled={!documentary || !commercial || loading} className="rounded-lg bg-sky-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50" onClick={() => void checkNeon()}>{loading ? "Lecture en cours..." : "3. Simuler avec l'inventaire Neon"}</button>
      {inventory && <span className="text-xs text-slate-600">Inventaire lu : {new Date(inventory.checkedAt).toLocaleString("fr-FR")}</span>}
    </div>
    {inventoryError && <p role="alert" className="mt-2 text-xs text-red-700">{inventoryError}</p>}
    {result?.error && <p role="alert" className="mt-2 text-xs text-red-700">{result.error}</p>}
    {result && !result.error && <>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">{[["Groupes parents candidats",result.families],["Références contrôlées",result.rows.length],["Références bloquées",result.rows.filter(r=>r.operation==="BLOQUE").length],["À examiner (toutes causes)",result.rows.filter(r=>r.issues.length>0).length]].map(([label,count])=><div key={String(label)} className="rounded-lg bg-slate-50 p-3"><strong className="text-xl">{count}</strong><p className="text-xs text-slate-600">{label}</p></div>)}</div>
      <p className="mt-2 text-xs text-amber-800">Simulation indicative : parent/variante/accessoire à confirmer manuellement. Les références indexées seules ne sont PAS des produits créés. Aucune ligne n'est autorisée à la publication ; stocks non numériques = à confirmer ; prix fournisseur = à valider. Les 2 références hors sélection restent exclues.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input className="rounded border p-2 text-xs" aria-label="Chercher une référence V17" placeholder="Référence ou famille" value={query} onChange={e=>setQuery(e.target.value)}/>
        <select className="rounded border p-2 text-xs" value={filter} onChange={e=>setFilter(e.target.value)} aria-label="Filtrer les opérations V17"><option value="ALL">Toutes les opérations</option><option value="ISSUES">Avec anomalies</option>{operations.map(op=><option key={op} value={op}>{op}</option>)}</select>
        <button type="button" className="rounded border border-sky-700 px-3 py-2 text-xs font-bold text-sky-700" onClick={()=>exportJson("OYSTE-STOCKMAN-PLAN-IMPORT-V17-SANS-PRIX.json",{version:17,mode:"SIMULATION_ONLY",writesAuthorized:false,publicationAuthorized:false,inventoryCheckedAt:inventory?.checkedAt,parentsCandidates:result.families,excludedReferences:commercial?.horsSelection,rows:result.rows})}>Exporter le plan SANS prix ni stock chiffré</button>
      </div>
      <div className="mt-2 max-h-[450px] overflow-auto rounded border"><table className="w-full min-w-[950px] text-left text-xs"><thead className="sticky top-0 bg-slate-100"><tr>{["Référence","Produit parent candidat","Opération proposée","Présence Neon","Prix","Stock","Contrôles"].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{filtered.map(r=><tr key={r.reference} className="border-t align-top"><td className="p-2 font-bold">{r.reference}</td><td className="p-2">{r.famille}</td><td className="p-2">{r.operation}</td><td className="p-2">{r.neon}</td><td className="p-2">{r.price?"Relevé à valider":"Absent"}</td><td className="p-2">{r.stock?"Numérique relevé":"À confirmer"}</td><td className="p-2">{r.issues.join(" · ") || "Contrôle final requis"}</td></tr>)}</tbody></table></div>
      <p className="mt-2 text-xs text-slate-600">{filtered.length} références affichées / {result.rows.length}. Ce plan n'est pas un fichier d'import exécutable.</p>
    </>}
  </section>;
}
