"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Archive,
  Box,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Copy,
  Download,
  FileText,
  History,
  Mail,
  MapPin,
  MessageSquarePlus,
  MoreHorizontal,
  Phone,
  Printer,
  Send,
  UserRound,
  UsersRound,
  Wrench,
} from "lucide-react";
import Configurator3DViewer from "@/components/configurator/Configurator3DViewer";
import StatusBadge from "@/components/admin/StatusBadge";
import { buildConfiguration } from "@/lib/configurator/engine";
import type { Answers } from "@/lib/configurator/types";
import {
  formatAdminPrice,
  statusLabels,
  type ConfigurationRecord,
  type ConfigurationStatus,
} from "@/lib/admin/mock-data";

const workflow: Array<{ status: ConfigurationStatus; label: string }> = [
  { status: "new", label: "Nouvelle demande" },
  { status: "qualifying", label: "Qualification" },
  { status: "quote-preparation", label: "Devis" },
  { status: "quote-sent", label: "Envoyé" },
  { status: "won", label: "Validation" },
];

const statusRank: Record<ConfigurationStatus, number> = {
  new: 0,
  qualifying: 1,
  "quote-preparation": 2,
  "quote-sent": 3,
  won: 4,
  lost: 1,
};

function normalizeCapacity(value: string) {
  const number = Number(value.replace(/\D/g, ""));
  if (number >= 2000) return "2000";
  if (number >= 1000) return "1000";
  if (number >= 500) return "500";
  if (number >= 250) return "250";
  return "150";
}

function normalizeMeters(value: string, fallback: string) {
  const number = Number(value.replace(/\D/g, ""));
  if (!number) return fallback;
  const meters = number >= 100 ? Math.round(number / 1000) : number;
  return `${Math.min(Math.max(meters, 2), 8)}m`;
}

function buildViewerConfiguration(record: ConfigurationRecord) {
  const manualHoist = record.hoist.toLowerCase().includes("manuel");
  const electricTrolley = record.trolley.toLowerCase().includes("électrique");
  const answers: Answers = {
    potenceType: record.family,
    capacity: normalizeCapacity(record.capacity),
    reach: normalizeMeters(record.reach, "4m"),
    underBeamHeight: normalizeMeters(record.height, "4m"),
    environment: record.environment.toLowerCase().includes("extérieur") ? "outside" : "inside",
    hoistType: manualHoist ? "manual" : "electric",
    liftingHeight: "3m",
    hoistTrolleyMovement: electricTrolley ? "electric" : "manual",
    mechanicalOptions: [],
    electricalOptions: record.options.some((item) => item.toLowerCase().includes("interrupteur"))
      ? ["lockable-switch"]
      : [],
    outsideOptions: [],
  };

  return buildConfiguration({ answers, stepIndex: 0, selectedAccessoryIds: [] });
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-100 py-3 last:border-0">
      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</p>
      <p className="mt-1.5 text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}

export default function ConfigurationWorkspace({ record }: { record: ConfigurationRecord }) {
  const [activeTab, setActiveTab] = useState<"configuration" | "documents" | "history" | "quote" | "be">("configuration");
  const [status, setStatus] = useState<ConfigurationStatus>(record.status);
  const [owner, setOwner] = useState(record.owner);
  const [saved, setSaved] = useState(false);
  const [notes, setNotes] = useState(record.notes);
  const [noteDraft, setNoteDraft] = useState("");
  const viewerConfiguration = useMemo(() => buildViewerConfiguration(record), [record]);
  const completeness = record.family === "PFI" ? 92 : 84;
  const currentRank = statusRank[status];

  function addNote() {
    const text = noteDraft.trim();
    if (!text) return;
    setNotes((current) => [
      { date: "Aujourd’hui · à l’instant", author: "Aymeric D.", text },
      ...current,
    ]);
    setNoteDraft("");
  }

  function saveChanges() {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  const tabs = [
    { id: "configuration", label: "Configuration", icon: ClipboardList },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "history", label: "Historique", icon: History },
    { id: "quote", label: "Devis", icon: FileText },
    { id: "be", label: "Bureau d’études", icon: Wrench },
  ] as const;

  return (
    <main className="mx-auto w-full max-w-[1680px] p-4 md:p-7 xl:p-9">
      <Link href="/admin/configurations" className="inline-flex items-center gap-2 text-xs font-black text-slate-500 transition hover:text-slate-950">
        <ArrowLeft size={16} /> Retour aux configurations
      </Link>

      <section className="mt-5 overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-5 border-b border-slate-200 px-5 py-5 xl:flex-row xl:items-center xl:justify-between xl:px-7">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">{record.reference}</h1>
              <StatusBadge status={status} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-2 font-bold text-slate-800"><Building2 size={15} className="text-[#007f8f]" /> {record.customer.company}</span>
              <span>{record.customer.name}</span>
              <span>{formatAdminPrice(record.totalHt)} HT</span>
              <span>Créée le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(record.createdAt))}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"><Download size={16} /> Export PDF</button>
            <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"><Printer size={16} /> Imprimer</button>
            <button type="button" className="inline-flex items-center gap-2 rounded-xl bg-[#007f8f] px-5 py-3 text-xs font-black text-white shadow-lg shadow-cyan-950/10 transition hover:bg-[#006d79]"><FileText size={16} /> Générer le devis</button>
            <button type="button" className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white"><MoreHorizontal size={18} /></button>
          </div>
        </div>

        <div className="grid gap-2 border-b border-slate-200 bg-slate-50/80 px-5 py-4 sm:grid-cols-5 xl:px-7">
          {workflow.map((step, index) => {
            const done = currentRank > index || status === "won";
            const active = status !== "lost" && currentRank === index;
            return (
              <div key={step.status} className="relative flex items-center gap-3 rounded-xl px-2 py-2">
                {index < workflow.length - 1 ? <span className="absolute left-[31px] top-[42px] hidden h-px w-[calc(100%-18px)] bg-slate-200 sm:block" /> : null}
                <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-black ${done ? "border-[#007f8f] bg-[#007f8f] text-white" : active ? "border-orange-500 bg-orange-50 text-orange-600" : "border-slate-200 bg-white text-slate-400"}`}>
                  {done ? <Check size={14} strokeWidth={3} /> : index + 1}
                </span>
                <div className="min-w-0"><p className={`truncate text-[10px] font-black uppercase tracking-wide ${active ? "text-orange-600" : done ? "text-slate-800" : "text-slate-400"}`}>{step.label}</p><p className="mt-0.5 text-[9px] text-slate-400">{done ? "Terminé" : active ? "En cours" : "À venir"}</p></div>
              </div>
            );
          })}
        </div>

        <nav className="flex gap-1 overflow-x-auto px-4 pt-3 xl:px-7">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-xs font-black transition ${active ? "border-[#007f8f] text-[#006d79]" : "border-transparent text-slate-400 hover:text-slate-700"}`}><Icon size={15} />{tab.label}</button>;
          })}
        </nav>
      </section>

      {activeTab === "configuration" ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_350px]">
          <aside className="space-y-5">
            <section className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-orange-600">Client</p>
              <div className="mt-4 flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><UserRound size={22} /></div><div><p className="font-black text-slate-950">{record.customer.name}</p><p className="mt-1 text-xs text-slate-500">{record.customer.company}</p></div></div>
              <div className="mt-5 space-y-3 text-xs"><a href={`mailto:${record.customer.email}`} className="flex items-center gap-3 text-slate-600"><Mail size={16} className="text-slate-400" /> {record.customer.email}</a><a href={`tel:${record.customer.phone}`} className="flex items-center gap-3 text-slate-600"><Phone size={16} className="text-slate-400" /> {record.customer.phone}</a><p className="flex items-center gap-3 text-slate-600"><MapPin size={16} className="text-slate-400" /> {record.customer.city}</p></div>
            </section>

            <section className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Complétude</p><span className="text-sm font-black text-[#007f8f]">{completeness}%</span></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#007f8f]" style={{ width: `${completeness}%` }} /></div>
              <p className="mt-3 text-[11px] leading-5 text-slate-500">Le dossier contient les informations nécessaires à une première qualification commerciale.</p>
            </section>

            <section className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><MessageSquarePlus size={17} className="text-slate-400" /><h2 className="text-sm font-black">Notes internes</h2></div>
              <div className="mt-4 space-y-4">{notes.map((note) => <div key={`${note.date}-${note.text}`} className="border-l-2 border-slate-200 pl-3"><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{note.date} · {note.author}</p><p className="mt-1.5 text-[11px] leading-5 text-slate-700">{note.text}</p></div>)}</div>
              <textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} rows={3} placeholder="Ajouter une note interne…" className="mt-4 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs outline-none transition focus:border-[#007f8f] focus:bg-white" />
              <button type="button" onClick={addNote} className="mt-2 w-full rounded-xl border border-slate-200 py-2.5 text-xs font-black text-slate-700 transition hover:bg-slate-50">Ajouter la note</button>
            </section>
          </aside>

          <div className="space-y-5">
            <section className="overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-700">Vision 3D du dossier</p><h2 className="mt-1 text-xl font-black text-slate-950">{record.familyLabel}</h2></div><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#007f8f]/10 text-sm font-black text-[#006d79]">{record.family}</span></div>
              {record.family === "PFI" ? <div className="h-[420px] bg-slate-950"><Configurator3DViewer configuration={viewerConfiguration} presentation immersive /></div> : <div className="flex h-[280px] flex-col items-center justify-center bg-gradient-to-br from-slate-950 to-[#102b35] px-8 text-center text-white"><Box size={42} className="text-cyan-300" /><p className="mt-5 text-lg font-black">Visualisation 3D en préparation</p><p className="mt-2 max-w-md text-xs leading-5 text-white/55">Cette famille reste entièrement configurable. Son modèle 3D interactif sera intégré progressivement.</p></div>}
            </section>

            <section className="overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-700">Résumé technique</p><h2 className="mt-1 text-lg font-black text-slate-950">Configuration sélectionnée</h2></div><div className="grid gap-x-8 px-5 py-2 sm:grid-cols-2"><InfoRow label="Capacité" value={record.capacity} /><InfoRow label="Portée" value={record.reach} /><InfoRow label="Hauteur" value={record.height} /><InfoRow label="Environnement" value={record.environment} /><InfoRow label="Fixation" value={record.fixing} /><InfoRow label="Alimentation" value={record.powerSupply} /><InfoRow label="Type de palan" value={record.hoist} /><InfoRow label="Déplacement" value={record.trolley} /></div></section>

            <section className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-slate-950">Options et compléments</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{record.options.length ? record.options.map((option) => <div key={option} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-700"><CheckCircle2 size={17} className="text-emerald-600" /> {option}</div>) : <p className="text-sm text-slate-400">Aucune option complémentaire.</p>}</div></section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-[1.4rem] bg-[#07131f] p-5 text-white shadow-xl"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300">Montant estimatif</p><p className="mt-3 text-4xl font-black tracking-tight">{formatAdminPrice(record.totalHt)}</p><p className="mt-1 text-xs text-white/45">Total hors taxes issu du configurateur</p><div className="my-5 h-px bg-white/10" /><label className="text-[9px] font-black uppercase tracking-[0.16em] text-white/40">Statut du dossier</label><select value={status} onChange={(event) => setStatus(event.target.value as ConfigurationStatus)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/8 px-3 py-3 text-xs font-black text-white outline-none">{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value} className="text-slate-950">{label}</option>)}</select><label className="mt-4 block text-[9px] font-black uppercase tracking-[0.16em] text-white/40">Responsable</label><select value={owner} onChange={(event) => setOwner(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/8 px-3 py-3 text-xs font-black text-white outline-none"><option>Non assigné</option><option>Thomas R.</option><option>Élodie M.</option><option>Aymeric D.</option></select><button type="button" onClick={saveChanges} className="mt-4 w-full rounded-xl bg-orange-500 py-3 text-xs font-black uppercase tracking-wide text-white transition hover:bg-orange-400">{saved ? "Modifications enregistrées" : "Enregistrer les modifications"}</button></section>

            <section className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Actions rapides</p><div className="mt-3 space-y-1">{[
              [Send, "Envoyer au bureau d’études"], [FileText, "Préparer le devis"], [Copy, "Dupliquer la configuration"], [UsersRound, "Réassigner le dossier"], [Download, "Télécharger le récapitulatif"], [Archive, "Archiver le dossier"],
            ].map(([Icon, label]) => <button key={label as string} type="button" className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"><span className="flex items-center gap-3"><Icon size={16} className="text-slate-400" />{label as string}</span><ChevronRight size={14} className="text-slate-300" /></button>)}</div></section>

            <section className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><CalendarDays size={18} className="text-slate-400" /><h2 className="text-base font-black">Historique récent</h2></div><div className="mt-5 space-y-5">{record.timeline.map((event, index) => <div key={`${event.date}-${event.title}`} className="relative pl-6">{index < record.timeline.length - 1 ? <span className="absolute left-[5px] top-4 h-[calc(100%+12px)] w-px bg-slate-200" /> : null}<span className="absolute left-0 top-1.5 h-3 w-3 rounded-full border-2 border-white bg-[#007f8f] ring-1 ring-slate-200" /><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{event.date}</p><p className="mt-1 text-xs font-black text-slate-800">{event.title}</p><p className="mt-1 text-[11px] leading-4 text-slate-500">{event.description}</p></div>)}</div></section>
          </aside>
        </div>
      ) : (
        <section className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-10 text-center shadow-sm"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">{activeTab === "documents" ? <FileText size={26} /> : activeTab === "history" ? <History size={26} /> : activeTab === "be" ? <Wrench size={26} /> : <ClipboardList size={26} />}</div><h2 className="mt-5 text-xl font-black text-slate-950">Module {tabs.find((tab) => tab.id === activeTab)?.label}</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">L’espace est déjà préparé dans le parcours du dossier. Son workflow complet sera activé dans la prochaine version du back-office.</p></section>
      )}
    </main>
  );
}
