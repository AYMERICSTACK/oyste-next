"use client";

import { useMemo, useState } from "react";
import { Download, ExternalLink, LoaderCircle, PackageCheck, RefreshCw, Truck } from "lucide-react";
import { toast } from "sonner";
import type { OrderRecord } from "@/lib/admin/orders-data";
import type { SendcloudShippingOption } from "@/lib/integrations/sendcloud";

const carrierLabel = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const money = (value: number | null, currency: string | null) => value == null ? "Tarif non remonté" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency || "EUR" }).format(value);

export default function SendcloudShipmentPanel({ orderId, initialShipment }: { orderId: string; initialShipment: OrderRecord["shipment"] }) {
  const [shipment, setShipment] = useState(initialShipment);
  const [dimensions, setDimensions] = useState({ weightKg: "2", lengthCm: "30", widthCm: "20", heightCm: "15" });
  const [options, setOptions] = useState<SendcloudShippingOption[]>([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const selected = useMemo(() => options.find((option) => option.code === selectedCode) || null, [options, selectedCode]);

  async function loadOptions() {
    setLoading(true);
    try {
      const query = new URLSearchParams(dimensions);
      const response = await fetch(`/api/admin/commandes/${orderId}/sendcloud?${query}`, { cache: "no-store" });
      const payload = await response.json() as { options?: SendcloudShippingOption[]; message?: string; shipment?: OrderRecord["shipment"] };
      if (!response.ok) throw new Error(payload.message || "Impossible de récupérer les transporteurs.");
      if (payload.shipment) { setShipment(payload.shipment); return; }
      const next = payload.options || [];
      setOptions(next); setSelectedCode(next[0]?.code || "");
      if (!next.length) toast.error("Aucun service compatible avec ce colis.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Erreur Sendcloud."); }
    finally { setLoading(false); }
  }

  async function createShipment() {
    if (!selected || creating) return;
    setCreating(true);
    try {
      const response = await fetch(`/api/admin/commandes/${orderId}/sendcloud`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...dimensions, option: selected }) });
      const payload = await response.json() as { shipment?: OrderRecord["shipment"]; message?: string };
      if (!response.ok || !payload.shipment) throw new Error(payload.message || "Création impossible.");
      setShipment(payload.shipment); toast.success("Expédition et étiquette Sendcloud créées.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Création impossible."); }
    finally { setCreating(false); }
  }

  if (shipment) return <section className="rounded-[1.4rem] border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
    <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white"><PackageCheck size={20}/></span><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-700">Étiquette créée</p><h2 className="text-base font-black">{carrierLabel(shipment.carrierName)}</h2></div></div>
    <div className="mt-4 space-y-2 text-xs"><p><strong>Service :</strong> {shipment.shippingOptionName}</p><p><strong>Colis :</strong> {shipment.weightKg} kg · {shipment.lengthCm} × {shipment.widthCm} × {shipment.heightCm} cm</p><p><strong>Suivi :</strong> {shipment.trackingNumber || "En cours d’attribution"}</p></div>
    <div className="mt-4 flex flex-wrap gap-2"><a href={`/api/admin/expeditions/${shipment.id}/label`} target="_blank" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-black text-white"><Download size={15}/> Imprimer l’étiquette</a>{shipment.trackingUrl ? <a href={shipment.trackingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-xs font-black text-emerald-800">Voir le suivi <ExternalLink size={14}/></a> : null}</div>
  </section>;

  return <section className="rounded-[1.4rem] border border-cyan-200 bg-white p-5 shadow-sm">
    <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700"><Truck size={20}/></span><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-700">Transport petits colis</p><h2 className="text-base font-black">Créer l’expédition Sendcloud</h2></div></div>
    <div className="mt-4 grid grid-cols-2 gap-3"><label className="text-[9px] font-black uppercase text-slate-400">Poids (kg)<input value={dimensions.weightKg} onChange={(e)=>setDimensions({...dimensions,weightKg:e.target.value})} type="number" step="0.1" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs text-slate-900"/></label><label className="text-[9px] font-black uppercase text-slate-400">Longueur (cm)<input value={dimensions.lengthCm} onChange={(e)=>setDimensions({...dimensions,lengthCm:e.target.value})} type="number" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs text-slate-900"/></label><label className="text-[9px] font-black uppercase text-slate-400">Largeur (cm)<input value={dimensions.widthCm} onChange={(e)=>setDimensions({...dimensions,widthCm:e.target.value})} type="number" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs text-slate-900"/></label><label className="text-[9px] font-black uppercase text-slate-400">Hauteur (cm)<input value={dimensions.heightCm} onChange={(e)=>setDimensions({...dimensions,heightCm:e.target.value})} type="number" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs text-slate-900"/></label></div>
    <button onClick={loadOptions} disabled={loading} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-xs font-black text-slate-700">{loading?<LoaderCircle size={15} className="animate-spin"/>:<RefreshCw size={15}/>} Rechercher les services</button>
    {options.length ? <div className="mt-4 space-y-2"><label className="text-[9px] font-black uppercase text-slate-400">Transporteur et service</label><select value={selectedCode} onChange={(e)=>setSelectedCode(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-xs font-bold">{options.map((option)=><option key={option.code} value={option.code}>{carrierLabel(option.carrierName)} — {option.name} — {money(option.price,option.currency)}</option>)}</select><button onClick={createShipment} disabled={!selected || creating} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-xs font-black uppercase tracking-wide text-white">{creating?<LoaderCircle size={15} className="animate-spin"/>:<Truck size={15}/>} Créer et imprimer l’étiquette</button><p className="text-[10px] leading-4 text-slate-400">La création annonce réellement le colis au transporteur et peut générer des frais.</p></div> : null}
  </section>;
}
