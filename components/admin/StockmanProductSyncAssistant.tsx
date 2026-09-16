"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, LoaderCircle, PackageSearch, RefreshCw, Scale, Warehouse } from "lucide-react";
import type { StockmanProductSyncTarget, StockmanSyncResult } from "@/lib/suppliers/stockman/types";

type TargetState = StockmanProductSyncTarget & { syncResult?: StockmanSyncResult };

export default function StockmanProductSyncAssistant({ productId, initialTargets }: { productId: string; initialTargets: StockmanProductSyncTarget[] }) {
  const [targets, setTargets] = useState<TargetState[]>(initialTargets);
  const [selectedId, setSelectedId] = useState(initialTargets[0]?.targetId ?? "");
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const selected = useMemo(() => targets.find((target) => target.targetId === selectedId) ?? targets[0], [selectedId, targets]);

  async function synchronize() {
    if (!selected) return;
    setSyncing(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/catalogue/${encodeURIComponent(productId)}/stockman/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: selected.targetType, targetId: selected.targetId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "La synchronisation Stockman a échoué.");
      setTargets((current) => current.map((target) => target.targetId === selected.targetId ? {
        ...target,
        stock: payload.sync.current.stock,
        weightKg: payload.sync.current.weightKg,
        purchasePriceExVat: payload.sync.current.purchasePriceExVat,
        syncedAt: payload.sync.syncedAt,
        sourceUrl: payload.product.sourceUrl,
        designation: payload.product.designation,
        syncResult: payload.sync,
      } : target));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "La synchronisation Stockman a échoué.");
    } finally {
      setSyncing(false);
    }
  }

  if (!targets.length) {
    return (
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><PackageSearch size={19} /></div><div><h3 className="text-sm font-black">Assistant Stockman</h3><p className="mt-0.5 text-xs font-bold text-slate-400">Aucune liaison disponible</p></div></div>
        <p className="mt-4 text-xs leading-5 text-slate-500">Cette fiche ne possède pas encore de référence Stockman synchronisée. Effectuez une première liaison depuis la page Fournisseurs pour enregistrer l’URL source.</p>
        <a href="/admin/fournisseurs" className="mt-4 inline-flex items-center gap-2 text-xs font-black text-[#007f8f] hover:underline">Ouvrir les fournisseurs <ExternalLink size={13} /></a>
      </section>
    );
  }

  if (!selected) return null;

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-[#007f8f]"><PackageSearch size={19} /></div><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-black">Assistant Stockman</h3><span className="rounded-full bg-orange-50 px-2 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-orange-700">RC3</span></div><p className="mt-1 text-xs leading-5 text-slate-500">Actualisez la fiche depuis sa source fournisseur.</p></div></div>
          <CheckCircle2 size={19} className="shrink-0 text-emerald-500" />
        </div>
      </div>

      <div className="p-5">
        {targets.length > 1 ? <label className="block"><span className="mb-2 block text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Référence à actualiser</span><select value={selected.targetId} onChange={(event) => { setSelectedId(event.target.value); setMessage(""); }} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-black outline-none focus:border-[#007f8f]">{targets.map((target) => <option key={target.targetId} value={target.targetId}>{target.targetType === "product" ? `Produit principal · ${target.reference}` : `${target.reference} · ${target.name}`}</option>)}</select></label> : null}

        <div className={targets.length > 1 ? "mt-4" : ""}>
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-emerald-600">Synchronisé</p>
          <p className="mt-1 text-base font-black text-slate-950">{selected.reference}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{selected.designation || selected.name}</p>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Metric icon={Warehouse} label="Stock" value={`${selected.stock}`} />
          <Metric icon={Scale} label="Poids" value={selected.weightKg === null ? "—" : `${selected.weightKg} kg`} />
          <Metric icon={PackageSearch} label="Achat HT" value={selected.purchasePriceExVat === null ? "—" : selected.purchasePriceExVat.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} />
        </div>

        <p className="mt-4 text-[9px] font-bold text-slate-400">Dernière synchronisation : {selected.syncedAt ? new Date(selected.syncedAt).toLocaleString("fr-FR") : "non renseignée"}</p>

        {selected.syncResult ? <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3"><p className="text-[10px] font-black text-emerald-800">Mise à jour réussie</p><p className="mt-1 text-[9px] font-bold leading-4 text-emerald-700">Stock {selected.syncResult.previous.stock} → {selected.syncResult.current.stock} · Poids {selected.syncResult.previous.weightKg ?? "—"} → {selected.syncResult.current.weightKg ?? "—"} kg · Achat {selected.syncResult.previous.purchasePriceExVat?.toLocaleString("fr-FR", { style: "currency", currency: "EUR" }) ?? "—"} → {selected.syncResult.current.purchasePriceExVat.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</p></div> : null}
        {message ? <div className="mt-3 flex gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-[10px] font-bold leading-4 text-red-700"><AlertCircle size={15} className="shrink-0" />{message}</div> : null}

        <button type="button" onClick={synchronize} disabled={syncing || !selected.sourceUrl} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#007f8f] px-4 py-3 text-xs font-black text-white transition hover:bg-[#006c79] disabled:cursor-not-allowed disabled:opacity-50">{syncing ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={16} />}{syncing ? "Actualisation en cours…" : "Actualiser depuis Stockman"}</button>
        <a href={selected.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-[10px] font-black text-[#007f8f] hover:underline">Voir la fiche source <ExternalLink size={12} /></a>
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Warehouse; label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><Icon size={14} className="text-[#007f8f]" /><p className="mt-2 truncate text-xs font-black text-slate-950">{value}</p><p className="mt-1 text-[7px] font-black uppercase tracking-[0.11em] text-slate-400">{label}</p></div>;
}
