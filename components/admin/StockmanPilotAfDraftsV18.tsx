"use client";

import { useMemo, useState } from "react";

const REFS = ["AF2436", "AF2448", "AF3048", "AF3060", "AF3672"] as const;
const SOURCE = "https://www.stockman.fr/fr/diables-et-chariots-de-manutention--6/chariots-et-servantes--11/--1/chariot-aluminium-charge-lourde-900-kg--AF.aspx";
type CommercialRow = { reference: string; designation: string; sourceUrl: string; prixAchatHT: number | null; stockNumerique: number | null; captureAt: string | null; etatDocumentaire: string; anomalies: string[]; publicationAutorisee: false; transportInclus: true };
type Data = { version: number; mode: string; writesAuthorized: false; publicationAuthorized: false; rows: CommercialRow[] };
type Inventory = { version: number; checkedAt: string; rows: { reference: string; catalogActive: boolean; productOrVariantExists: boolean; draft: { id: string; reference: string; status: string } | null }[] };
const normal = (s: string) => s.trim().toUpperCase();
const okStock = (v: unknown) => v === null || (typeof v === "number" && Number.isSafeInteger(v) && v >= 0);

export default function StockmanPilotAfDraftsV18() {
  const [commercial, setCommercial] = useState<Data | null>(null);
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const selected = useMemo(() => REFS.map(ref => commercial?.rows.find(r => normal(r.reference) === ref)).filter((r): r is CommercialRow => Boolean(r)), [commercial]);
  const problems = useMemo(() => {
    const items: string[] = [];
    if (!commercial || selected.length !== 5) items.push("Les 5 references AF doivent figurer dans le V15.");
    for (const row of selected) {
      if (row.sourceUrl !== SOURCE) items.push(`${row.reference} : fiche source inattendue.`);
      if (row.etatDocumentaire !== "PRET_DOCUMENTAIRE_NON_PUBLIABLE") items.push(`${row.reference} : controle documentaire non valide.`);
      if (typeof row.prixAchatHT !== "number" || !Number.isFinite(row.prixAchatHT) || row.prixAchatHT <= 0) items.push(`${row.reference} : prix fournisseur manquant.`);
      if (!okStock(row.stockNumerique)) items.push(`${row.reference} : stock invalide.`);
      if (!row.captureAt || Number.isNaN(Date.parse(row.captureAt))) items.push(`${row.reference} : date de releve manquante.`);
      if (row.publicationAutorisee !== false || row.transportInclus !== true) items.push(`${row.reference} : regles de securite inattendues.`);
      if ((row.anomalies || []).some(a => /BLOCAGE|PRIX_HT_ABSENT|CONTRADICT|DOCUMENTAIRE/i.test(a))) items.push(`${row.reference} : anomalie bloquante.`);
    }
    if (!inventory) items.push("Relancer l'inventaire Neon pour ce pilote.");
    else for (const item of inventory.rows) {
      if (!item.catalogActive) items.push(`${item.reference} : reference inactive dans Neon.`);
      if (item.productOrVariantExists) items.push(`${item.reference} : produit/variante deja present.`);
      if (item.draft) items.push(`${item.reference} : brouillon deja present (${item.draft.status}).`);
    }
    return items;
  }, [commercial, selected, inventory]);
  async function load(file?: File) {
    setCommercial(null); setInventory(null); setChecked(false); setError(""); setInfo("");
    if (!file) return;
    try {
      if (file.size > 8_000_000) throw Error("Fichier trop volumineux.");
      const data: Data = JSON.parse(await file.text());
      if (data.version !== 15 || data.mode !== "READ_ONLY_LOCAL" || data.writesAuthorized !== false || data.publicationAuthorized !== false || !Array.isArray(data.rows) || data.rows.length !== 92 || new Set(data.rows.map(r => normal(r.reference))).size !== 92) throw Error("Le JSON V15 doit contenir exactement 92 references uniques, en lecture seule.");
      setCommercial(data);
    } catch (e) { setError(e instanceof Error ? e.message : "JSON invalide."); }
  }
  async function refresh() {
    setBusy(true); setError(""); setInfo(""); setChecked(false); setInventory(null);
    try {
      const response = await fetch("/api/admin/suppliers/stockman/pilot-af-drafts", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || data.version !== 18 || !Array.isArray(data.rows) || data.rows.length !== 5) throw Error(data.error || `Inventaire invalide (${response.status}).`);
      setInventory(data as Inventory);
    } catch (e) { setError(e instanceof Error ? e.message : "Inventaire indisponible."); }
    finally { setBusy(false); }
  }
  async function create() {
    if (problems.length || !checked || selected.length !== 5) return;
    setBusy(true); setError(""); setInfo("");
    try {
      const response = await fetch("/api/admin/suppliers/stockman/pilot-af-drafts", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CREATE_AF_IMPORT_DRAFTS", acknowledged: true, rows: selected.map(r => ({ reference: r.reference, designation: r.designation, purchasePriceHT: r.prixAchatHT, supplierStock: r.stockNumerique, sourceReadAt: r.captureAt })) }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || data.message || `Erreur HTTP ${response.status}`);
      setInfo(`${data.created} brouillons d'import crees dans Neon. Aucun produit cree, aucune publication.`);
      setChecked(false);
      const audit = await fetch("/api/admin/suppliers/stockman/pilot-af-drafts", { cache: "no-store" });
      if (audit.ok) setInventory(await audit.json());
    } catch (e) { setError(e instanceof Error ? e.message : "Creation interrompue."); }
    finally { setBusy(false); }
  }
  return <section className="mt-4 rounded-xl border border-emerald-300 bg-white p-4">
    <h4 className="text-sm font-black text-slate-950">Pilote STOCKMAN V18 — 5 brouillons d'import AF</h4>
    <p className="mt-1 text-xs text-slate-600">Uniquement le groupe « Chariot aluminium charge lourde 900 kg ». Ne cree PAS de fiches Product ou de variantes. Aucun prix de vente defini, aucune publication. Les prix d'achat et stocks des 5 references ne sont transmis a Neon qu'apres validation explicite.</p>
    <div className="mt-3 flex flex-wrap items-end gap-3">
      <label className="text-xs font-semibold">Fichier commercial prive V15 (reste local jusqu'a validation)
        <input type="file" accept=".json,application/json" className="mt-1 block max-w-full text-xs" onChange={e => void load(e.currentTarget.files?.[0])}/>
      </label>
      <button type="button" disabled={!commercial || busy} onClick={() => void refresh()} className="rounded-lg bg-sky-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Verifier les 5 references dans Neon</button>
    </div>
    {commercial && <p className="mt-2 text-xs text-slate-600">Fichier V15 valide : {selected.length}/5 references AF retrouvees. Transport inclus. Stock absent = non confirme.</p>}
    {inventory && <p className="mt-2 text-xs text-slate-600">Inventaire Neon releve le {new Date(inventory.checkedAt).toLocaleString("fr-FR")}.</p>}
    {commercial && <div className="mt-3 overflow-x-auto rounded border"><table className="w-full min-w-[700px] text-left text-xs"><thead className="bg-slate-100"><tr>{["Reference", "Designation", "Prix achat", "Stock", "Neon", "Brouillon"].map(h => <th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{selected.map(r => { const i = inventory?.rows.find(x=>x.reference===normal(r.reference)); return <tr key={r.reference} className="border-t"><td className="p-2 font-bold">{r.reference}</td><td className="p-2">{r.designation}</td><td className="p-2">{r.prixAchatHT === null ? "Absent" : "Releve HT a valider"}</td><td className="p-2">{r.stockNumerique === null ? "A confirmer" : "Numerique releve"}</td><td className="p-2">{!i ? "Non verifie" : i.productOrVariantExists ? "Produit existant" : i.catalogActive ? "Index seul" : "Index inactif"}</td><td className="p-2">{i?.draft ? `Existe : ${i.draft.status}` : "Aucun releve"}</td></tr>; })}</tbody></table></div>}
    {commercial && <div className="mt-3 text-xs">{problems.length ? <p className="text-amber-800"><strong>Creation bloquee :</strong> {problems.join(" · ")}</p> : <p className="text-emerald-800">Les cinq references sont admissibles a la creation de brouillons d'import. Aucune fiche produit ne sera creee.</p>}</div>}
    {commercial && <label className="mt-3 flex items-start gap-2 text-xs"><input type="checkbox" checked={checked} disabled={busy || problems.length > 0} onChange={e=>setChecked(e.target.checked)}/><span>Je confirme la creation de 5 brouillons STOCKMAN dans Neon, avec transmission des prix d'achat et stocks de ces seules references. Je comprends qu'aucun prix de vente ni produit publiable n'est cree.</span></label>}
    {commercial && <button type="button" disabled={busy || !checked || problems.length > 0} onClick={() => void create()} className="mt-3 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Creer les 5 brouillons d'import dans Neon</button>}
    {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    {info && <p role="status" className="mt-2 text-xs font-bold text-emerald-800">{info}</p>}
  </section>;
}
