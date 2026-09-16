"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileSearch, FileText, Loader2, MailCheck, UploadCloud } from "lucide-react";

type OrderOption = { id: string; reference: string; totalTtc: unknown; currency: string; createdAt: string; paymentStatus: string; customer: { id: string; email: string; firstName: string | null; lastName: string | null; company: string | null }; _count: { invoices: number } };
type InvoiceRow = { id: string; number: string | null; filename: string; size: number; notifiedAt: string | null; createdAt: string; order: { reference: string }; customer: { email: string; company: string | null } };
type Recognition = { filename: string; size: number; invoiceNumberSuggestion: string; match: (OrderOption & { score: number; reasons: string[] }) | null; ambiguous: boolean; alternatives: Array<OrderOption & { score: number; reasons: string[] }>; orders: OrderOption[] };

export default function InvoiceWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [recognition, setRecognition] = useState<Recognition | null>(null);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [orderId, setOrderId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    const response = await fetch("/api/admin/invoices", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) { setOrders(data.orders || []); setInvoices(data.invoices || []); }
  }
  useEffect(() => { void refresh(); }, []);

  async function analyze() {
    if (!file) return;
    setWorking(true); setError(""); setMessage("");
    const form = new FormData(); form.set("action", "recognize"); form.set("file", file);
    try {
      const response = await fetch("/api/admin/invoices", { method: "POST", body: form });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Analyse impossible.");
      setRecognition(data); setOrders(data.orders || orders); setOrderId(data.match?.id || ""); setInvoiceNumber(data.invoiceNumberSuggestion || "");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Analyse impossible."); }
    finally { setWorking(false); }
  }

  async function confirm() {
    if (!file || !orderId) return;
    const selected = orders.find((order) => order.id === orderId);
    if (!selected || !window.confirm(`Publier ${file.name} pour ${selected.customer.company || selected.customer.email} · commande ${selected.reference} ?\n\nLe client sera notifié immédiatement par email.`)) return;
    setWorking(true); setError(""); setMessage("");
    const form = new FormData(); form.set("action", "confirm"); form.set("file", file); form.set("orderId", orderId); form.set("invoiceNumber", invoiceNumber);
    try {
      const response = await fetch("/api/admin/invoices", { method: "POST", body: form });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Import impossible.");
      setMessage(`Facture enregistrée pour ${data.orderReference}. ${data.emailSent ? `Email envoyé à ${data.customerEmail}.` : "Facture disponible, mais email non envoyé."}`);
      setFile(null); setRecognition(null); setOrderId(""); setInvoiceNumber(""); await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Import impossible."); }
    finally { setWorking(false); }
  }

  const selected = useMemo(() => orders.find((order) => order.id === orderId) || null, [orders, orderId]);

  return <div className="space-y-6">
    <section className="rounded-[1.6rem] border border-cyan-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-[#007f8f]"><UploadCloud size={24}/></span><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-orange-600">V2.12.0 · Facturation</p><h2 className="mt-1 text-xl font-black">Déposer une facture PDF</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">OYSTE recherche automatiquement la référence de commande, l’email ou la société dans le PDF. Aucune notification ne part avant votre validation.</p></div></div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto]"><label className="flex min-h-28 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-5 text-center hover:border-cyan-300"><input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e)=>{ setFile(e.target.files?.[0] || null); setRecognition(null); setOrderId(""); setMessage(""); setError(""); }}/><div><FileText size={26} className="mx-auto text-slate-400"/><p className="mt-2 text-sm font-black text-slate-800">{file ? file.name : "Choisir ou déposer un PDF"}</p><p className="mt-1 text-xs text-slate-400">PDF uniquement · 12 Mo maximum</p></div></label><button onClick={()=>void analyze()} disabled={!file || working} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-4 text-xs font-black text-white disabled:opacity-40">{working ? <Loader2 size={17} className="animate-spin"/> : <FileSearch size={17}/>}Analyser et reconnaître</button></div>
      {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</div> : null}
      {message ? <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-black text-emerald-800"><CheckCircle2 size={16}/>{message}</div> : null}

      {recognition ? <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase text-slate-400">Résultat du rapprochement</p><p className="mt-1 text-sm font-black">{recognition.match ? `Correspondance proposée : ${recognition.match.reference}` : recognition.ambiguous ? "Plusieurs correspondances possibles" : "Aucune correspondance certaine"}</p>{recognition.match?.reasons?.length ? <p className="mt-1 text-xs text-emerald-700">{recognition.match.reasons.join(" · ")}</p> : null}</div>{recognition.match ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black text-emerald-800">Score {recognition.match.score}</span> : null}</div>
        <div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-xs font-black text-slate-600">Commande / client<select value={orderId} onChange={(e)=>setOrderId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-bold"><option value="">Sélectionner…</option>{orders.map((order)=><option key={order.id} value={order.id}>{order.reference} · {order.customer.company || order.customer.email} · {order.customer.email}</option>)}</select></label><label className="text-xs font-black text-slate-600">N° de facture<input value={invoiceNumber} onChange={(e)=>setInvoiceNumber(e.target.value)} placeholder="Ex. FA-2026-001245" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-bold"/></label></div>
        {selected ? <div className="mt-4 rounded-xl bg-white p-4 text-xs"><strong>{selected.customer.company || `${selected.customer.firstName || ""} ${selected.customer.lastName || ""}`}</strong><span className="mx-2 text-slate-300">·</span>{selected.customer.email}<span className="mx-2 text-slate-300">·</span>{selected.reference}</div> : null}
        <button onClick={()=>void confirm()} disabled={!file || !orderId || working} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-xs font-black text-white disabled:opacity-40"><MailCheck size={16}/>Valider, publier et notifier le client</button>
      </div> : null}
    </section>

    <section className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-6 py-5"><h2 className="text-lg font-black">Dernières factures mises à disposition</h2></div>{invoices.length ? <div className="divide-y divide-slate-100">{invoices.map((invoice)=><div key={invoice.id} className="grid gap-3 px-6 py-4 md:grid-cols-[1fr_1fr_auto] md:items-center"><div><p className="font-black">{invoice.number || invoice.filename}</p><p className="mt-1 text-xs text-slate-400">Commande {invoice.order.reference}</p></div><div className="text-xs"><p className="font-bold">{invoice.customer.company || invoice.customer.email}</p><p className="mt-1 text-slate-400">{invoice.customer.email}</p></div><span className={`rounded-full px-3 py-1 text-[10px] font-black ${invoice.notifiedAt ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{invoice.notifiedAt ? "Client notifié" : "Email non envoyé"}</span></div>)}</div> : <div className="p-10 text-center text-sm text-slate-400">Aucune facture importée pour le moment.</div>}</section>
  </div>;
}
