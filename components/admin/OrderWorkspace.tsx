"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Box, Building2, Check, ClipboardCheck, CreditCard, Download, Factory, Eye, FileCheck2, Mail, MapPin, PackageCheck, Phone, Printer, Save, Truck, UserRound } from "lucide-react";
import Configurator3DViewer from "@/components/configurator/Configurator3DViewer";
import { buildConfiguration } from "@/lib/configurator/engine";
import type { Answers } from "@/lib/configurator/types";
import OrderStatusBadge from "./OrderStatusBadge";
import SendcloudShipmentPanel from "./SendcloudShipmentPanel";
import { formatAdminPrice, orderStatusLabels, type OrderRecord, type OrderStatus } from "@/lib/admin/orders-data";

const workflow: Array<{ status: OrderStatus; label: string; icon: typeof Check }> = [
  { status: "paid", label: "Payée", icon: CreditCard },
  { status: "engineering", label: "Étude", icon: ClipboardCheck },
  { status: "production", label: "Fabrication", icon: Factory },
  { status: "quality-control", label: "Contrôle", icon: PackageCheck },
  { status: "ready-to-ship", label: "Expédition", icon: Truck },
];
const rank: Record<OrderStatus, number> = { "pending-payment": 0, paid: 0, engineering: 1, production: 2, "quality-control": 3, "ready-to-ship": 4, shipped: 5, completed: 5, cancelled: 0 };

function meters(value: string, fallback: string) { const n = Number(value.replace(/\D/g, "")); return n ? `${Math.min(Math.max(Math.round(n / 1000), 2), 8)}m` : fallback; }
function viewer(record: OrderRecord) {
  if (record.family === "CATALOGUE") return null;
  const answers: Answers = {
    potenceType: record.family,
    capacity: Number(record.capacity.replace(/\D/g, "")) >= 2000 ? "2000" : Number(record.capacity.replace(/\D/g, "")) >= 1000 ? "1000" : Number(record.capacity.replace(/\D/g, "")) >= 500 ? "500" : "250",
    reach: meters(record.reach, "4m"),
    underBeamHeight: meters(record.height, "4m"),
    environment: record.environment.toLowerCase().includes("extérieur") ? "outside" : "inside",
    hoistType: record.hoist.toLowerCase().includes("manuel") ? "manual" : "electric",
    liftingHeight: "3m",
    hoistTrolleyMovement: record.trolley.toLowerCase().includes("électrique") ? "electric" : "manual",
    mechanicalOptions: [], electricalOptions: record.options.some((option) => option.toLowerCase().includes("interrupteur")) ? ["lockable-switch"] : [], outsideOptions: [],
  };
  return buildConfiguration({ answers, stepIndex: 0, selectedAccessoryIds: [] });
}
function Info({ label, value }: { label: string; value: string }) { return <div className="border-b border-slate-100 py-3 last:border-0"><p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</p><p className="mt-1.5 text-sm font-bold text-slate-800">{value}</p></div>; }

export default function OrderWorkspace({ record }: { record: OrderRecord }) {
  const [status, setStatus] = useState<OrderStatus>(record.status);
  const [owner, setOwner] = useState(record.productionOwner);
  const [saved, setSaved] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(record.paymentStatus);
  const [saving, setSaving] = useState(false);
  const [supplierAckSaving, setSupplierAckSaving] = useState(false);
  const [supplierAckError, setSupplierAckError] = useState("");
  const [confirmedLeadTime, setConfirmedLeadTime] = useState(record.supplierAck?.confirmedLeadTime || "");
  const [supplierAckReference, setSupplierAckReference] = useState(record.supplierAck?.supplierAckReference || "");
  const [supplierName, setSupplierName] = useState(record.supplierAck?.supplierName || record.items?.[0]?.supplier || "Fournisseur");
  const configuration = useMemo(() => viewer(record), [record]);
  const currentRank = rank[status];
  async function saveSupplierAck() {
    if (!confirmedLeadTime.trim()) {
      setSupplierAckError("Renseignez le délai confirmé indiqué sur l’AR fournisseur.");
      return;
    }
    setSupplierAckSaving(true);
    setSupplierAckError("");
    try {
      const response = await fetch(`/api/admin/commandes/${record.id}/supplier-ack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmedLeadTime, supplierAckReference, supplierName }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Enregistrement impossible.");
      window.location.reload();
    } catch (error) {
      setSupplierAckError(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setSupplierAckSaving(false);
    }
  }

  async function generateCustomerAck() {
    setSupplierAckSaving(true);
    setSupplierAckError("");
    try {
      const response = await fetch(`/api/admin/commandes/${record.id}/customer-ack`, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Génération impossible.");
      window.open(payload.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setSupplierAckError(error instanceof Error ? error.message : "Génération impossible.");
    } finally {
      setSupplierAckSaving(false);
    }
  }

  async function save(paymentReceived = false) {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/commandes/${record.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, paymentReceived }) });
      if (!response.ok) throw new Error();
      if (paymentReceived) { setPaymentStatus("paid"); setStatus("paid"); }
      setSaved(true); window.setTimeout(() => setSaved(false), 1600);
    } finally { setSaving(false); }
  }

  return <main className="mx-auto w-full max-w-[1680px] p-4 md:p-7 xl:p-9">
    <Link href="/admin/commandes" className="inline-flex items-center gap-2 text-xs font-black text-slate-500 hover:text-slate-950"><ArrowLeft size={16} /> Retour aux commandes</Link>
    <section className="mt-5 overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-5 border-b border-slate-200 px-5 py-5 xl:flex-row xl:items-center xl:justify-between xl:px-7"><div><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-black tracking-tight md:text-4xl">{record.reference}</h1><OrderStatusBadge status={status} /></div><div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500"><span className="inline-flex items-center gap-2 font-bold text-slate-800"><Building2 size={15} className="text-[#007f8f]" />{record.customer.company}</span><span>{record.customer.name}</span><span>{formatAdminPrice(record.totalTtc)} TTC</span></div></div><div className="flex flex-wrap gap-2"><button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-xs font-black text-slate-700"><Download size={16} /> Bon de commande</button><button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-xs font-black text-slate-700"><Printer size={16} /> Imprimer</button></div></div>
      <div className="grid gap-2 border-b border-slate-200 bg-slate-50/80 px-5 py-4 sm:grid-cols-5 xl:px-7">{workflow.map((step, index) => { const Icon = step.icon; const done = currentRank > index || status === "shipped" || status === "completed"; const active = currentRank === index && !done; return <div key={step.status} className="flex items-center gap-3 rounded-xl px-2 py-2"><span className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${done ? "border-[#007f8f] bg-[#007f8f] text-white" : active ? "border-orange-500 bg-orange-50 text-orange-600" : "border-slate-200 bg-white text-slate-400"}`}>{done ? <Check size={15} strokeWidth={3} /> : <Icon size={15} />}</span><div><p className={`text-[10px] font-black uppercase ${active ? "text-orange-600" : done ? "text-slate-800" : "text-slate-400"}`}>{step.label}</p><p className="mt-0.5 text-[9px] text-slate-400">{done ? "Terminé" : active ? "En cours" : "À venir"}</p></div></div>; })}</div>
    </section>

    <div className="mt-6 space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_390px]">
        <div>
          <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-orange-600">Produit commandé</p><h2 className="mt-1 text-lg font-black">{record.familyLabel}</h2></div><span className="rounded-xl bg-[#007f8f]/10 px-3 py-2 text-xs font-black text-[#006d79]">{record.family}</span></div><div className="h-[420px] bg-[#eef3f5]">{record.family === "PFI" && configuration ? <Configurator3DViewer configuration={configuration} /> : <div className="flex h-full flex-col items-center justify-center text-center"><Box size={40} className="text-slate-300" /><p className="mt-4 text-sm font-black text-slate-600">Aperçu 3D en préparation</p><p className="mt-1 text-xs text-slate-400">Les données techniques restent disponibles ci-dessous.</p></div>}</div></section>
        </div>
        <div>
          <section className="rounded-[1.4rem] bg-[#07131f] p-5 text-white shadow-xl"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300">Pilotage opérationnel</p><label className="mt-4 block text-[9px] font-black uppercase text-white/45">Statut</label><select value={status} onChange={(event) => setStatus(event.target.value as OrderStatus)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/8 px-3 py-3 text-xs font-black text-white outline-none">{Object.entries(orderStatusLabels).map(([value, label]) => <option key={value} value={value} className="text-slate-950">{label}</option>)}</select><label className="mt-4 block text-[9px] font-black uppercase text-white/45">Responsable</label><select value={owner} onChange={(event) => setOwner(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/8 px-3 py-3 text-xs font-black text-white outline-none"><option className="text-slate-950">À planifier</option><option className="text-slate-950">Bureau d’études</option><option className="text-slate-950">Atelier 1</option><option className="text-slate-950">Atelier 2</option><option className="text-slate-950">Contrôle qualité</option><option className="text-slate-950">Logistique</option></select><button type="button" onClick={() => save(false)} disabled={saving} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-xs font-black uppercase tracking-wide text-white"><Save size={15} />{saving ? "Enregistrement…" : saved ? "Enregistré" : "Enregistrer"}</button>{paymentStatus === "pending" ? <button type="button" onClick={() => save(true)} disabled={saving} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 py-3 text-xs font-black uppercase tracking-wide text-emerald-800"><CreditCard size={15}/>Confirmer le virement reçu</button> : <div className="mt-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-center text-xs font-black text-emerald-800">Paiement reçu</div>}</section>
        </div>
      </div>

      <section className="rounded-[1.4rem] border border-violet-200 bg-violet-50/40 p-5 shadow-sm">
          <div className="flex items-center gap-2"><Mail size={17} className="text-violet-700" /><h2 className="text-base font-black">Documents & communications client</h2></div>
          <p className="mt-2 text-[11px] font-semibold leading-5 text-slate-500">Prévisualisez les rendus réellement utilisés par OYSTE. Ces boutons n’envoient aucun email.</p>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <a href={`/admin/commandes/${encodeURIComponent(record.id)}/communications/order`} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-xl border border-violet-100 bg-white p-3 transition hover:border-violet-300">
              <div><p className="text-xs font-black text-slate-950">Confirmation de commande</p><p className="mt-1 text-[10px] font-semibold text-slate-500">Email envoyé après enregistrement de la commande.</p></div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-violet-100 px-2.5 py-2 text-[10px] font-black text-violet-800"><Eye size={13}/>Voir</span>
            </a>
            <a href={`/admin/commandes/${encodeURIComponent(record.id)}/communications/payment`} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-white p-3 transition hover:border-emerald-300">
              <div><p className="text-xs font-black text-slate-950">Confirmation de paiement</p><p className="mt-1 text-[10px] font-semibold text-slate-500">Email envoyé dès validation du règlement.</p></div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-2 text-[10px] font-black text-emerald-800"><Eye size={13}/>Voir</span>
            </a>
            <a href={`/admin/commandes/${encodeURIComponent(record.id)}/ar`} target="_blank" rel="noreferrer" className={`flex items-center justify-between gap-3 rounded-xl border bg-white p-3 transition ${record.supplierAck?.confirmedLeadTime ? "border-cyan-100 hover:border-cyan-300" : "pointer-events-none border-slate-100 opacity-45"}`}>
              <div><p className="text-xs font-black text-slate-950">AR / Confirmation client</p><p className="mt-1 text-[10px] font-semibold text-slate-500">{record.supplierAck?.confirmedLeadTime ? "Document basé sur le délai fournisseur confirmé." : "Disponible après réception de l’AR fournisseur."}</p></div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-cyan-100 px-2.5 py-2 text-[10px] font-black text-cyan-800"><Eye size={13}/>Voir</span>
            </a>
          </div>
        </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
        <div className="grid gap-6 md:grid-cols-2"><article className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-base font-black">Configuration technique</h2><div className="mt-3"><Info label="Capacité" value={record.capacity} /><Info label="Portée" value={record.reach} /><Info label="Hauteur" value={record.height} /><Info label="Fixation" value={record.fixing} /><Info label="Environnement" value={record.environment} /></div></article><article className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-base font-black">Équipement</h2><div className="mt-3"><Info label="Palan" value={record.hoist} /><Info label="Chariot" value={record.trolley} /><Info label="Alimentation" value={record.powerSupply} /><Info label="Options" value={record.options.length ? record.options.join(" · ") : "Aucune option"} /></div></article></div>
        <section className="rounded-[1.4rem] border border-cyan-200 bg-cyan-50/50 p-5 shadow-sm">
          <div className="flex items-center gap-2"><FileCheck2 size={17} className="text-[#007f8f]" /><h2 className="text-base font-black">AR fournisseur / confirmation client</h2></div>
          <p className="mt-2 text-[11px] font-semibold leading-5 text-slate-500">Le délai affiché au catalogue reste estimatif. La confirmation client est générée uniquement après réception de l’AR fournisseur.</p>
          <div className="mt-4 space-y-2">
            {(record.items || []).map((item) => <div key={item.id} className="rounded-xl bg-white p-3 text-[11px]"><div className="font-black">{item.supplier} · {item.reference || item.name}</div><div className="mt-1 text-[#007f8f]">{item.estimatedLeadTime}</div><div className="mt-1 text-[10px] text-slate-400">{item.estimatedLeadTimeNote}</div></div>)}
          </div>
          <label className="mt-4 block text-[9px] font-black uppercase text-slate-500">Fournisseur</label>
          <input value={supplierName} onChange={(e)=>setSupplierName(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-bold outline-none"/>
          <label className="mt-3 block text-[9px] font-black uppercase text-slate-500">Référence AR fournisseur</label>
          <input value={supplierAckReference} onChange={(e)=>setSupplierAckReference(e.target.value)} placeholder="Ex. AR-45872" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-bold outline-none"/>
          <label className="mt-3 block text-[9px] font-black uppercase text-slate-500">Délai confirmé</label>
          <input value={confirmedLeadTime} onChange={(e)=>setConfirmedLeadTime(e.target.value)} placeholder="Ex. Départ usine semaine 42" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-bold outline-none"/>
          {supplierAckError ? <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700">{supplierAckError}</div> : null}
          <button type="button" onClick={()=>void saveSupplierAck()} disabled={supplierAckSaving} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#007f8f] py-3 text-xs font-black text-white disabled:opacity-50"><Save size={15}/>{supplierAckSaving?"Enregistrement…":"Enregistrer l’AR fournisseur"}</button>
          <button type="button" onClick={()=>void generateCustomerAck()} disabled={supplierAckSaving || !record.supplierAck?.confirmedLeadTime} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-black text-white disabled:opacity-40"><Printer size={15}/>Générer l’AR client</button>
          {!record.supplierAck?.confirmedLeadTime ? <p className="mt-2 text-center text-[10px] font-bold text-amber-700">Disponible après enregistrement du délai confirmé fournisseur.</p> : null}
        </section>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <section className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-base font-black">Client</h2><div className="mt-4 space-y-3 text-xs text-slate-600"><p className="flex items-center gap-3"><UserRound size={16} className="text-slate-400" />{record.customer.name}</p><p className="flex items-center gap-3"><Mail size={16} className="text-slate-400" />{record.customer.email}</p><p className="flex items-center gap-3"><Phone size={16} className="text-slate-400" />{record.customer.phone}</p><p className="flex items-center gap-3"><MapPin size={16} className="text-slate-400" />{record.customer.city}</p></div></section>
        <section className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-base font-black">Livraison</h2><div className="mt-3"><Info label="Mode" value={record.delivery.mode} /><Info label="Adresse" value={record.delivery.address} /><Info label="Date demandée" value={record.delivery.requestedDate} /></div></section>
        <section className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-base font-black">Récapitulatif financier</h2><div className="mt-4 space-y-3"><div className="flex justify-between text-xs text-slate-500"><span>Total HT</span><strong className="text-slate-800">{formatAdminPrice(record.totalHt)}</strong></div><div className="flex justify-between text-xs text-slate-500"><span>TVA</span><strong className="text-slate-800">{formatAdminPrice(record.totalTtc - record.totalHt)}</strong></div><div className="border-t border-slate-200 pt-3 flex justify-between"><span className="text-sm font-black">Total TTC</span><strong className="text-xl font-black text-[#007f8f]">{formatAdminPrice(record.totalTtc)}</strong></div></div></section>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.55fr)_390px]">
        <section className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-base font-black">Historique de la commande</h2><div className="mt-5 space-y-5">{record.timeline.map((event, index) => <div key={event.date} className="relative pl-6">{index < record.timeline.length - 1 ? <span className="absolute left-[5px] top-4 h-[calc(100%+12px)] w-px bg-slate-200" /> : null}<span className="absolute left-0 top-1.5 h-3 w-3 rounded-full border-2 border-white bg-[#007f8f] ring-1 ring-slate-200" /><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{event.date}</p><p className="mt-1 text-xs font-black text-slate-800">{event.title}</p><p className="mt-1 text-[11px] leading-4 text-slate-500">{event.description}</p></div>)}</div></section>
        <SendcloudShipmentPanel orderId={record.id} initialShipment={record.shipment} />
      </div>
    </div>
  </main>;
}
