"use client";

import { useMemo, useState } from "react";

type CommercialRow = {
  reference: string; designation: string; sourceUrl: string; sousFamille: string;
  prixAchatHT: number | null; stockNumerique: number | null; captureAt: string | null;
  etatDocumentaire: string; classification: string; anomalies: string[];
  publicationAutorisee: false; transportInclus: true;
};
type CommercialFile = { version: number; mode: string; writesAuthorized: false; publicationAuthorized: false; rows: CommercialRow[] };
type InventoryRow = { reference: string; eligibleDocumentary: boolean; catalogActive: boolean; productOrVariantExists: boolean; existingDraftStatus: string | null };
type Inventory = { version: number; checkedAt: string; rows: InventoryRow[] };
const normalize = (s: string) => s.trim().toUpperCase();
const safePrice = (p: unknown) => typeof p === "number" && Number.isFinite(p) && p > 0 && p <= 1_000_000;
const safeStock = (s: unknown) => s === null || (typeof s === "number" && Number.isSafeInteger(s) && s >= 0 && s <= 1_000_000);

export default function StockmanBulkDraftsV19() {
  const [commercial, setCommercial] = useState<CommercialFile | null>(null);
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const analysis = useMemo(() => {
    if (!commercial || !inventory) return null;
    const byRef = new Map(inventory.rows.map(x => [normalize(x.reference), x]));
    const create: CommercialRow[] = [];
    const excluded: { reference: string; why: string }[] = [];
    for (const row of commercial.rows) {
      const ref = normalize(row.reference);
      const s = byRef.get(ref);
      let why = "";
      if (!s) why = "Hors inventaire Neon";
      else if (!s.eligibleDocumentary || row.etatDocumentaire !== "PRET_DOCUMENTAIRE_NON_PUBLIABLE" || row.classification !== "VARIANTE_A_VERIFIER") why = "Blocage, controle documentaire ou accessoire";
      else if (!s.catalogActive) why = "Index STOCKMAN inactif ou absent";
      else if (s.productOrVariantExists) why = "Produit/variante deja present";
      else if (s.existingDraftStatus !== null) why = `Brouillon deja present (${s.existingDraftStatus})`;
      else if (!safePrice(row.prixAchatHT) || !safeStock(row.stockNumerique)) why = "Prix ou stock invalide";
      else if (row.publicationAutorisee !== false || row.transportInclus !== true) why = "Regles commerciales inattendues";
      else if (!row.captureAt || !Number.isFinite(Date.parse(row.captureAt)) || Date.now() - Date.parse(row.captureAt) > 30 * 86400000 || Date.parse(row.captureAt) > Date.now()+60000) why = "Releve commercial perime";
      else if ((row.anomalies ?? []).some(a => /BLOCAGE|PRIX_HT_ABSENT|CONTRADICT|DOCUMENTAIRE/i.test(a))) why = "Anomalie bloquante";
      else create.push(row);
      if (why) excluded.push({ reference: ref, why });
    }
    return { create, excluded, totalGroups: new Set(create.map(x => x.sourceUrl)).size };
  }, [commercial, inventory]);
  async function load(file?: File) {
    setCommercial(null); setInventory(null); setAcknowledged(false); setResult(""); setError("");
    if (!file) return;
    try {
      if (file.size > 8_000_000) throw new Error("Fichier V15 trop volumineux.");
      const d: CommercialFile = JSON.parse(await file.text());
      if (d.version !== 15 || d.mode !== "READ_ONLY_LOCAL" || d.writesAuthorized !== false || d.publicationAuthorized !== false || !Array.isArray(d.rows) || d.rows.length !== 92 || new Set(d.rows.map(x => normalize(x.reference))).size !== 92) throw Error("Fichier V15 invalide : 92 references uniques attendues.");
      setCommercial(d);
    } catch (e) { setError(e instanceof Error ? e.message : "Fichier non reconnu."); }
  }
  async function check() {
    setBusy(true); setInventory(null); setAcknowledged(false); setError(""); setResult("");
    try {
      const response = await fetch("/api/admin/suppliers/stockman/bulk-diables-drafts", { cache: "no-store" });
      const d = await response.json();
      if (!response.ok || d.version !== 19 || !Array.isArray(d.rows) || d.rows.length !== 92) throw Error(d.error ?? `Inventaire invalide (HTTP ${response.status}).`);
      setInventory(d);
    } catch(e) { setError(e instanceof Error ? e.message : "Inventaire indisponible."); }
    finally { setBusy(false); }
  }
  async function create() {
    if (!acknowledged || !analysis?.create.length || busy) return;
    setBusy(true); setError(""); setResult("");
    try {
      const response = await fetch("/api/admin/suppliers/stockman/bulk-diables-drafts", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CREATE_DIABLES_IMPORT_DRAFTS", acknowledged: true,
          rows: analysis.create.map(r => ({ reference: normalize(r.reference), designation: r.designation,
            sourceUrl: r.sourceUrl, purchasePriceHT: r.prixAchatHT,
            supplierStock: r.stockNumerique, sourceReadAt: r.captureAt })) }),
      });
      const d = await response.json();
      if (!response.ok) throw Error(`${d.error ?? `Erreur HTTP ${response.status}`}${d.references?.length ? ` : ${d.references.join(", ")}` : ""}${d.partial ? " - verifiez le resultat dans Neon" : ""}`);
      setResult(`${d.created}/${d.requested} brouillons d'import crees dans Neon. Aucun Product, aucune variante, aucune publication.`);
      setAcknowledged(false);
      const audit = await fetch("/api/admin/suppliers/stockman/bulk-diables-drafts", { cache: "no-store" });
      if (audit.ok) setInventory(await audit.json());
    } catch(e) { setError(e instanceof Error ? e.message : "Creation impossible."); }
    finally { setBusy(false); }
  }
  return <section className="mt-4 rounded-xl border border-emerald-300 bg-white p-4">
    <h4 className="text-sm font-black text-slate-950">STOCKMAN V19 — Brouillons groupés Diables et chariots</h4>
    <p className="mt-1 text-xs text-slate-600">Un seul lot sur les 92 references V15. Les 3 bloquees, 4 controles cibles et les accessoires non qualifies ne sont pas crees. Un brouillon d'import n'est pas un produit : aucune variante Product, aucun prix de vente, aucune publication. Les montants restent locaux jusqu'a confirmation.</p>
    <div className="mt-3 flex flex-wrap items-end gap-3">
      <label className="text-xs font-semibold">Relevé commercial privé V15 (JSON)
        <input type="file" accept=".json,application/json" className="mt-1 block max-w-full text-xs" onChange={e => void load(e.currentTarget.files?.[0])} />
      </label>
      <button type="button" disabled={!commercial || busy} onClick={() => void check()} className="rounded-lg bg-sky-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">1. Vérifier les 92 références dans Neon</button>
    </div>
    {inventory && <p className="mt-2 text-xs text-slate-500">Inventaire Neon du {new Date(inventory.checkedAt).toLocaleString("fr-FR")}. Les doublons et brouillons existants sont exclus.</p>}
    {analysis && <>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="rounded bg-slate-100 p-3"><div className="text-xl font-black">{commercial?.rows.length}</div><div className="text-xs">Références contrôlées</div></div>
        <div className="rounded bg-emerald-50 p-3"><div className="text-xl font-black">{analysis.create.length}</div><div className="text-xs">Brouillons candidats</div></div>
        <div className="rounded bg-slate-100 p-3"><div className="text-xl font-black">{analysis.totalGroups}</div><div className="text-xs">Fiches source concernées</div></div>
        <div className="rounded bg-amber-50 p-3"><div className="text-xl font-black">{analysis.excluded.length}</div><div className="text-xs">Exclues ou déjà présentes</div></div>
      </div>
      <button type="button" className="mt-3 rounded border px-3 py-1 text-xs" onClick={() => setShowDetails(v => !v)}>{showDetails ? "Masquer" : "Afficher"} les exclusions</button>
      {showDetails && <div className="mt-2 max-h-48 overflow-auto rounded border p-2 text-xs">{analysis.excluded.map(e => <p key={e.reference}>{e.reference} — {e.why}</p>)}</div>}
      <p className="mt-3 text-xs text-amber-800">Les prix d'achat restent à valider. Stocks numériques = relevés, non réservations. Frais de transport déjà inclus. Les brouillons ne regroupent pas encore les variantes dans un produit parent.</p>
      <label className="mt-3 flex items-start gap-2 text-xs"><input type="checkbox" checked={acknowledged} disabled={busy || analysis.create.length === 0} onChange={e => setAcknowledged(e.target.checked)}/><span>Je confirme l'écriture de {analysis.create.length} brouillons d'import STOCKMAN dans Neon avec leurs prix d'achat et stocks relevés. Je comprends qu'aucune fiche Product ou variante, aucun prix de vente et aucune publication ne seront créés.</span></label>
      <button type="button" disabled={busy || !acknowledged || analysis.create.length === 0} onClick={() => void create()} className="mt-3 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">2. Créer {analysis.create.length} brouillons d'import dans Neon</button>
    </>}
    {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
    {result && <p role="status" className="mt-3 text-xs font-bold text-emerald-800">{result}</p>}
  </section>;
}
