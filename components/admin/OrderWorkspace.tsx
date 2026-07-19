"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Box, Building2, Check, ClipboardCheck, CreditCard, Download, Factory, Mail, MapPin, PackageCheck, Phone, Printer, Save, Truck, UserRound } from "lucide-react";
import Configurator3DViewer from "@/components/configurator/Configurator3DViewer";
import { buildConfiguration } from "@/lib/configurator/engine";
import type { Answers } from "@/lib/configurator/types";
import OrderStatusBadge from "./OrderStatusBadge";
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
  const configuration = useMemo(() => viewer(record), [record]);
  const currentRank = rank[status];
  function save() { setSaved(true); window.setTimeout(() => setSaved(false), 1600); }

  return <main className="mx-auto w-full max-w-[1680px] p-4 md:p-7 xl:p-9">
    <Link href="/admin/commandes" className="inline-flex items-center gap-2 text-xs font-black text-slate-500 hover:text-slate-950"><ArrowLeft size={16} /> Retour aux commandes</Link>
    <section className="mt-5 overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-5 border-b border-slate-200 px-5 py-5 xl:flex-row xl:items-center xl:justify-between xl:px-7"><div><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-black tracking-tight md:text-4xl">{record.reference}</h1><OrderStatusBadge status={status} /></div><div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500"><span className="inline-flex items-center gap-2 font-bold text-slate-800"><Building2 size={15} className="text-[#007f8f]" />{record.customer.company}</span><span>{record.customer.name}</span><span>{formatAdminPrice(record.totalTtc)} TTC</span></div></div><div className="flex flex-wrap gap-2"><button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-xs font-black text-slate-700"><Download size={16} /> Bon de commande</button><button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-xs font-black text-slate-700"><Printer size={16} /> Imprimer</button></div></div>
      <div className="grid gap-2 border-b border-slate-200 bg-slate-50/80 px-5 py-4 sm:grid-cols-5 xl:px-7">{workflow.map((step, index) => { const Icon = step.icon; const done = currentRank > index || status === "shipped" || status === "completed"; const active = currentRank === index && !done; return <div key={step.status} className="flex items-center gap-3 rounded-xl px-2 py-2"><span className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${done ? "border-[#007f8f] bg-[#007f8f] text-white" : active ? "border-orange-500 bg-orange-50 text-orange-600" : "border-slate-200 bg-white text-slate-400"}`}>{done ? <Check size={15} strokeWidth={3} /> : <Icon size={15} />}</span><div><p className={`text-[10px] font-black uppercase ${active ? "text-orange-600" : done ? "text-slate-800" : "text-slate-400"}`}>{step.label}</p><p className="mt-0.5 text-[9px] text-slate-400">{done ? "Terminé" : active ? "En cours" : "À venir"}</p></div></div>; })}</div>
    </section>

    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_390px]">
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-orange-600">Produit commandé</p><h2 className="mt-1 text-lg font-black">{record.familyLabel}</h2></div><span className="rounded-xl bg-[#007f8f]/10 px-3 py-2 text-xs font-black text-[#006d79]">{record.family}</span></div><div className="h-[420px] bg-[#eef3f5]">{record.family === "PFI" ? <Configurator3DViewer configuration={configuration} /> : <div className="flex h-full flex-col items-center justify-center text-center"><Box size={40} className="text-slate-300" /><p className="mt-4 text-sm font-black text-slate-600">Aperçu 3D en préparation</p><p className="mt-1 text-xs text-slate-400">Les données techniques restent disponibles ci-dessous.</p></div>}</div></section>
        <section className="grid gap-6 md:grid-cols-2"><article className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-base font-black">Configuration technique</h2><div className="mt-3"><Info label="Capacité" value={record.capacity} /><Info label="Portée" value={record.reach} /><Info label="Hauteur" value={record.height} /><Info label="Fixation" value={record.fixing} /><Info label="Environnement" value={record.environment} /></div></article><article className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-base font-black">Équipement</h2><div className="mt-3"><Info label="Palan" value={record.hoist} /><Info label="Chariot" value={record.trolley} /><Info label="Alimentation" value={record.powerSupply} /><Info label="Options" value={record.options.length ? record.options.join(" · ") : "Aucune option"} /></div></article></section>
        <section className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-base font-black">Historique de la commande</h2><div className="mt-5 space-y-5">{record.timeline.map((event, index) => <div key={event.date} className="relative pl-6">{index < record.timeline.length - 1 ? <span className="absolute left-[5px] top-4 h-[calc(100%+12px)] w-px bg-slate-200" /> : null}<span className="absolute left-0 top-1.5 h-3 w-3 rounded-full border-2 border-white bg-[#007f8f] ring-1 ring-slate-200" /><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{event.date}</p><p className="mt-1 text-xs font-black text-slate-800">{event.title}</p><p className="mt-1 text-[11px] leading-4 text-slate-500">{event.description}</p></div>)}</div></section>
      </div>
      <aside className="space-y-6">
        <section className="rounded-[1.4rem] bg-[#07131f] p-5 text-white shadow-xl"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300">Pilotage opérationnel</p><label className="mt-4 block text-[9px] font-black uppercase text-white/45">Statut</label><select value={status} onChange={(event) => setStatus(event.target.value as OrderStatus)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/8 px-3 py-3 text-xs font-black text-white outline-none">{Object.entries(orderStatusLabels).map(([value, label]) => <option key={value} value={value} className="text-slate-950">{label}</option>)}</select><label className="mt-4 block text-[9px] font-black uppercase text-white/45">Responsable</label><select value={owner} onChange={(event) => setOwner(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/8 px-3 py-3 text-xs font-black text-white outline-none"><option className="text-slate-950">À planifier</option><option className="text-slate-950">Bureau d’études</option><option className="text-slate-950">Atelier 1</option><option className="text-slate-950">Atelier 2</option><option className="text-slate-950">Contrôle qualité</option><option className="text-slate-950">Logistique</option></select><button type="button" onClick={save} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-xs font-black uppercase tracking-wide text-white"><Save size={15} />{saved ? "Enregistré" : "Enregistrer"}</button></section>
        <section className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-base font-black">Client</h2><div className="mt-4 space-y-3 text-xs text-slate-600"><p className="flex items-center gap-3"><UserRound size={16} className="text-slate-400" />{record.customer.name}</p><p className="flex items-center gap-3"><Mail size={16} className="text-slate-400" />{record.customer.email}</p><p className="flex items-center gap-3"><Phone size={16} className="text-slate-400" />{record.customer.phone}</p><p className="flex items-center gap-3"><MapPin size={16} className="text-slate-400" />{record.customer.city}</p></div></section>
        <section className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-base font-black">Livraison</h2><div className="mt-3"><Info label="Mode" value={record.delivery.mode} /><Info label="Adresse" value={record.delivery.address} /><Info label="Date demandée" value={record.delivery.requestedDate} /></div></section>
        <section className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-base font-black">Récapitulatif financier</h2><div className="mt-4 space-y-3"><div className="flex justify-between text-xs text-slate-500"><span>Total HT</span><strong className="text-slate-800">{formatAdminPrice(record.totalHt)}</strong></div><div className="flex justify-between text-xs text-slate-500"><span>TVA</span><strong className="text-slate-800">{formatAdminPrice(record.totalTtc - record.totalHt)}</strong></div><div className="border-t border-slate-200 pt-3 flex justify-between"><span className="text-sm font-black">Total TTC</span><strong className="text-xl font-black text-[#007f8f]">{formatAdminPrice(record.totalTtc)}</strong></div></div></section>
      </aside>
    </div>
  </main>;
}
