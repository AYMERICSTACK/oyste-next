"use client";
import { useState } from "react";
import StockmanTe10liPriceV24 from "./StockmanTe10liPriceV24";
import StockmanCheckoutSourcesV25 from "./StockmanCheckoutSourcesV25";

type Variant = { reference: string; purchasePriceHT: number | null; salePriceHT: number | null; marginHT: number | null; marginRate: number | null; stockNumeric: number | null; flags: string[] };
type Row = { title: string; code: string; status: string; expectedVariants: number; foundVariants: number; imageCount: number; pdfCount: number; shippingMode: string | null; blockers: string[]; checks: string[]; variants: Variant[] };
type Audit = { checkedAt: string; counts: { groups: number; groupsFound: number; variantsFound: number; groupsWithBlockers: number; variantsWithoutConfirmedStock: number; variantsWithNonpositiveMargin: number; groupsShippingQuote: number; groupsMissingImage: number; groupsMissingPdf: number }; rows: Row[] };
const euro = (n: number | null) => n === null ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
const csvCell = (v: unknown) => {
 const raw = String(v ?? ""); const safe = /^\s*[=+@-]/.test(raw) ? "'" + raw : raw;
 return '"' + safe.replace(/"/g, '""') + '"';
};
export default function StockmanReadinessV22() {
 const [audit, setAudit] = useState<Audit | null>(null);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState("");
 const [search, setSearch] = useState("");
 const [onlyIssues, setOnlyIssues] = useState(false);
 const [showAmounts, setShowAmounts] = useState(false);
 const [shippingConfirmed, setShippingConfirmed] = useState(false);
 const [shippingResult, setShippingResult] = useState("");
 const [shippingBusy, setShippingBusy] = useState(false);
 async function run() {
  setBusy(true); setError(""); setAudit(null); setShowAmounts(false); setShippingConfirmed(false);
  try { const response = await fetch("/api/admin/suppliers/stockman/diables-readiness", { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`); setAudit(body as Audit); }
  catch(e) { setError(e instanceof Error ? e.message : "Lecture impossible"); }
  finally { setBusy(false); }
 }
 async function applyShipping() {
  if (!audit || !shippingConfirmed || shippingBusy || audit.counts.groupsShippingQuote === 0) return;
  setShippingBusy(true); setError(""); setShippingResult("");
  try {
   const res = await fetch("/api/admin/suppliers/stockman/diables-readiness", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "SET_STOCKMAN_DIABLES_SHIPPING_INCLUDED", confirmation: "JE CONFIRME TRANSPORT STOCKMAN INCLUS" }),
   });
   const body = await res.json();
   if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
   setShippingResult(`${body.updated} livraison(s) passees a INCLUS ; ${body.alreadyIncluded} deja incluses. Aucun prix, stock ou statut de publication modifie.`);
   setShippingConfirmed(false);
   await run();
  } catch (e) { setError(e instanceof Error ? e.message : "Correction impossible"); }
  finally { setShippingBusy(false); }
 }
 function exportExceptions() {
  if (!audit) return;
  const lines = [["Groupe", "Reference", "Statut", "Blocages", "Controles", "Alertes reference"]];
  for (const row of audit.rows) for (const v of row.variants.length ? row.variants : [{ reference: "", flags: [] }]) {
    if (!row.blockers.length && !row.checks.length && !v.flags.length) continue;
    lines.push([row.title, v.reference, row.status, row.blockers.join(" | "), row.checks.join(" | "), v.flags.join(" | ")]);
  }
  const csv = "\ufeff" + lines.map(line => line.map(csvCell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = "OYSTE-STOCKMAN-CONTROLE-FINAL-V22-SANS-MONTANTS.csv"; link.click(); URL.revokeObjectURL(url);
 }
 const filtered = audit?.rows.filter(r => (!onlyIssues || r.blockers.length > 0 || r.checks.length > 0 || r.variants.some(v => v.flags.length > 0)) && (!search || (r.title + " " + r.variants.map(v => v.reference).join(" ")).toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr")))) ?? [];
 return <section className="mt-5 rounded-xl border border-slate-300 bg-white p-4 text-sm text-slate-900">
  <h3 className="text-lg font-semibold">STOCKMAN V23 — Contrôle final et correction transport</h3>
  <p className="mt-1 text-slate-600">Audit des 45 produits DRAFT dans Neon : marges, stocks, photos, PDF et livraison. Aucun seuil de marge inventé. Lecture initiale sans modification ; correction du mode livraison uniquement sur confirmation explicite. Aucune publication. Les prix d'achat restent confidentiels.</p>
  <button type="button" disabled={busy} onClick={run} className="mt-3 rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-40">{busy ? "Controle en cours…" : "Contrôler les 45 fiches dans Neon"}</button>
  {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}
  {shippingResult && <p className="mt-3 font-semibold text-emerald-800">{shippingResult}</p>}
  {audit && <>
   <p className="mt-3 text-xs text-slate-600">Relevé Neon : {new Date(audit.checkedAt).toLocaleString("fr-FR")}</p>
   <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">{[
    ["Parents retrouvés", `${audit.counts.groupsFound}/${audit.counts.groups}`], ["Variantes", audit.counts.variantsFound],
    ["Parents avec blocage", audit.counts.groupsWithBlockers], ["Stocks non confirmés", audit.counts.variantsWithoutConfirmedStock],
    ["Marges non positives", audit.counts.variantsWithNonpositiveMargin], ["Livraison sur devis", audit.counts.groupsShippingQuote],
    ["Sans image", audit.counts.groupsMissingImage], ["Sans PDF", audit.counts.groupsMissingPdf],
   ].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-100 p-3"><div className="text-xs text-slate-600">{label}</div><div className="text-lg font-bold">{value}</div></div>)}</div>
   <p className="mt-3 text-amber-800">Une image enregistrée n'est pas forcément accessible ni correcte. Un stock numérique n'est pas une réservation. La livraison « sur devis » doit être validée avant publication. Un prix fournisseur relevé nécessite une validation commerciale.</p>
   <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
    <strong>Correction ciblee du transport STOCKMAN</strong>
    <p className="mt-1">Le moteur de livraison OYSTE prevoit le transport inclus pour STOCKMAN. Les 45 parents importes ont ete enregistres sur devis. Cette action aligne uniquement leur mode sur INCLUDED, en statut DRAFT. Aucun prix, stock, variante ou publication ne change.</p>
    <p className="mt-1 text-sm">{audit.counts.groupsShippingQuote} parents encore sur devis. {audit.counts.variantsWithNonpositiveMargin} variante(s) a marge non positive et {audit.counts.variantsWithoutConfirmedStock} stock(s) non confirmes restent a traiter separement.</p>
    <label className="mt-2 flex items-start gap-2"><input type="checkbox" checked={shippingConfirmed} onChange={e => setShippingConfirmed(e.target.checked)}/><span>Je confirme que la livraison STOCKMAN est incluse dans les prix de vente OYSTE pour ces 45 parents.</span></label>
    <button type="button" className="mt-2 rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-40" disabled={!shippingConfirmed || shippingBusy || audit.counts.groupsShippingQuote===0} onClick={applyShipping}>{shippingBusy ? "Correction en cours..." : "Corriger la livraison des 45 fiches DRAFT"}</button>
   </div>
   {audit.rows.some(r => r.variants.some(v => v.flags.includes("MARGE_NON_POSITIVE"))) && <div className="mt-3 rounded border border-red-300 p-3"><strong>Reference(s) a marge non positive : </strong>{audit.rows.flatMap(r=>r.variants.filter(v=>v.flags.includes("MARGE_NON_POSITIVE")).map(v=>`${v.reference} (${r.title})`)).join(" ; ")}. Prix a examiner manuellement ; aucune correction automatique.</div>}
   <div className="mt-3 flex flex-wrap items-center gap-3"><input className="rounded border p-2" placeholder="Groupe ou référence" value={search} onChange={e => setSearch(e.target.value)} /><label className="flex gap-2"><input type="checkbox" checked={onlyIssues} onChange={e => setOnlyIssues(e.target.checked)}/>Afficher les fiches à contrôler</label><label className="flex gap-2"><input type="checkbox" checked={showAmounts} onChange={e => setShowAmounts(e.target.checked)}/>Afficher prix et marges à l'écran</label><button type="button" onClick={exportExceptions} className="rounded border border-slate-400 px-3 py-2">Exporter les contrôles (CSV sans montants)</button></div>
   <div className="mt-3 max-h-[460px] overflow-auto rounded border"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-2">Parent / références</th><th className="p-2">Prix / marge</th><th className="p-2">Stock</th><th className="p-2">Livraison</th><th className="p-2">Contrôles</th></tr></thead><tbody>{filtered.map(row => <tr key={row.code} className="border-t align-top"><td className="p-2"><b>{row.title}</b><div className="text-slate-500">{row.foundVariants}/{row.expectedVariants} variantes · {row.imageCount} image(s) · {row.pdfCount} PDF</div>{row.variants.map(v => <div key={v.reference}>{v.reference}</div>)}</td><td className="p-2">{row.variants.map(v => <div key={v.reference}>{showAmounts ? `${euro(v.purchasePriceHT)} → ${euro(v.salePriceHT)} / marge ${euro(v.marginHT)} (${v.marginRate === null ? "—" : v.marginRate.toFixed(1) + " %"})` : "Montants masqués"}</div>)}</td><td className="p-2">{row.variants.map(v => <div key={v.reference}>{v.stockNumeric === null ? "À confirmer" : `Relevé : ${v.stockNumeric}`}</div>)}</td><td className="p-2">{row.shippingMode ?? "—"}</td><td className="p-2">{[...row.blockers,...row.checks].join(" · ") || "Contrôle final requis"}{row.variants.some(v => v.flags.includes("MARGE_NON_POSITIVE")) && <div className="font-semibold text-red-700">MARGE NON POSITIVE</div>}</td></tr>)}</tbody></table></div>
   <p className="mt-2 text-xs text-slate-600">{filtered.length} groupe(s) affiché(s). Aucun produit autorisé automatiquement à publier.</p>
  </>}
  <StockmanTe10liPriceV24 />
  <StockmanCheckoutSourcesV25 />
 </section>;
}
