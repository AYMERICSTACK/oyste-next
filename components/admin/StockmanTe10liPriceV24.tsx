"use client";
import { useState } from "react";

type Preview = { reference: string; productName: string | null; purchaseHT: number | null; currentSaleHT: number | null; sourceSaleHT: number | null; suggestedSaleHT: number; proposedMarginPct: number; status: string | null; priceSourceVersion: string | null; ready: boolean; errors: string[] };
const euro = (n: number | null) => n === null ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
const TOKEN = "CORRIGER TE10LI 3675";
export default function StockmanTe10liPriceV24() {
 const [data, setData] = useState<Preview | null>(null);
 const [busy, setBusy] = useState(false);
 const [confirm, setConfirm] = useState("");
 const [error, setError] = useState("");
 const [success, setSuccess] = useState("");
 async function load() {
  setBusy(true); setError(""); setConfirm(""); setSuccess("");
  try { const response = await fetch("/api/admin/suppliers/stockman/te10li-price", { cache: "no-store" }); const b = await response.json(); if (!response.ok) throw new Error(b.error || "Erreur de lecture"); setData(b as Preview); }
  catch(e) { setData(null); setError(e instanceof Error ? e.message : "Erreur"); }
  finally { setBusy(false); }
 }
 async function apply() {
  if (!data?.ready || confirm !== TOKEN || busy) return;
  setBusy(true); setError("");
  try {
   const res = await fetch("/api/admin/suppliers/stockman/te10li-price", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: TOKEN }) });
   const b = await res.json(); if (!res.ok) throw new Error(b.error || "Correction refusee");
   setSuccess("TE10LI corrigee a 3 675 EUR HT dans Neon : prix source, variante et parent. Aucune publication.");
   setData(null); setConfirm("");
  } catch(e) { setError(e instanceof Error ? e.message : "Erreur"); }
  finally { setBusy(false); }
 }
 return <div className="mt-4 rounded-xl border border-amber-400 bg-amber-50 p-4 text-sm">
  <h4 className="font-semibold">STOCKMAN V24 — Correction ciblee de TE10LI</h4>
  <p className="mt-1">Origine confirmee : ancienne simulation V133 (achat errone de 134 EUR). Proposition selon la regle historique de 20 % de marge sur vente. Ne concerne que TE10LI ; la fiche reste DRAFT.</p>
  <button type="button" disabled={busy} onClick={load} className="mt-3 rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-40">Verifier TE10LI dans Neon</button>
  {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
  {success && <p className="mt-2 font-semibold text-emerald-800">{success}</p>}
  {data && <div className="mt-3 space-y-2">
   <p>Prix achat fournisseur : <b>{euro(data.purchaseHT)}</b> — vente actuelle : <b>{euro(data.currentSaleHT)}</b> — tarif source : <b>{euro(data.sourceSaleHT)}</b>.</p>
   <p>Vente proposee : <b>{euro(data.suggestedSaleHT)}</b> HT (marge historique sur vente : {data.proposedMarginPct} %).</p>
   <p>Controle : <b>{data.ready ? "CONFORME POUR CORRECTION" : "BLOQUE"}</b>{data.errors.length ? ` : ${data.errors.join(" · ")}` : ""}</p>
   {data.ready && <><p>Si tu valides ce prix commercial, saisis exactement <b>{TOKEN}</b> :</p>
    <input className="w-full max-w-sm rounded border border-slate-400 bg-white p-2" placeholder={TOKEN} value={confirm} onChange={e => setConfirm(e.target.value)} />
    <button type="button" disabled={busy || confirm !== TOKEN} onClick={apply} className="ml-2 rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-40">Appliquer TE10LI seulement</button>
   </>}
   <p className="text-xs text-slate-600">Aucune modification des stocks, transport, autres variantes ou publication. L'ancien fichier local V137 reste a synchroniser avant un prochain import de tarifs.</p>
  </div>}
 </div>;
}
