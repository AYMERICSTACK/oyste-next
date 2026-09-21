"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileCheck2,
  FileSearch,
  FileText,
  Loader2,
  MailCheck,
  ReceiptText,
  Stamp,
  UploadCloud,
} from "lucide-react";

type OrderOption = {
  id: string;
  reference: string;
  totalTtc: unknown;
  currency: string;
  createdAt: string;
  paymentStatus: string;
  customer: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
  };
  _count: { invoices: number };
};

type AutomationOrder = OrderOption & {
  invoice: null | {
    id: string;
    number: string | null;
    status: string;
    issuedAt: string | null;
    pdfReady: boolean;
    filename: string | null;
    publishedAt: string | null;
    notifiedAt: string | null;
  };
};

type InvoiceRow = {
  id: string;
  sourceKey: string | null;
  number: string | null;
  type: string;
  status: string;
  issuedAt: string | null;
  filename: string | null;
  size: number | null;
  pdfReady: boolean;
  publishedAt: string | null;
  notifiedAt: string | null;
  createdAt: string;
  totalTtc: unknown;
  order: { reference: string };
  customer: { email: string; company: string | null };
};

type Recognition = {
  filename: string;
  size: number;
  invoiceNumberSuggestion: string;
  match: (OrderOption & { score: number; reasons: string[] }) | null;
  ambiguous: boolean;
  alternatives: Array<OrderOption & { score: number; reasons: string[] }>;
  orders: OrderOption[];
};

function euro(value: unknown, currency = "EUR") {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(Number(value || 0));
}

function invoiceStatusLabel(status: string) {
  if (status === "DRAFT") return "Brouillon";
  if (status === "ISSUED") return "Émise";
  if (status === "CANCELLED") return "Annulée";
  return status;
}

export default function InvoiceWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [recognition, setRecognition] = useState<Recognition | null>(null);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [automationOrders, setAutomationOrders] = useState<AutomationOrder[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [orderId, setOrderId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [working, setWorking] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    const response = await fetch("/api/admin/invoices", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) {
      setOrders(data.orders || []);
      setAutomationOrders(data.automationOrders || []);
      setInvoices(data.invoices || []);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function runAutomation(action: string, input: { orderId?: string; invoiceId?: string }, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    const key = input.invoiceId || input.orderId || action;
    setWorkingId(key);
    setError("");
    setMessage("");
    try {
      const form = new FormData();
      form.set("action", action);
      if (input.orderId) form.set("orderId", input.orderId);
      if (input.invoiceId) form.set("invoiceId", input.invoiceId);
      const response = await fetch("/api/admin/invoices", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Opération impossible.");
      if (action === "auto-create") setMessage("Brouillon de facture OYSTE créé. Aucun numéro n'a encore été consommé.");
      if (action === "auto-issue") setMessage(`Facture émise : ${data.number}.`);
      if (action === "auto-generate-pdf") setMessage(`PDF ${data.filename} généré et stocké. Il reste privé au back-office pour le moment.`);
      if (action === "auto-publish") setMessage(data.emailSent ? `Facture ${data.number} publiée dans l’espace client et email envoyé au client.` : data.alreadyNotified ? `La facture ${data.number} est déjà publiée et le client a déjà été notifié.` : `Facture ${data.number} publiée, mais l’email n’a pas pu être envoyé.`);
      if (action === "auto-notify") setMessage(data.emailSent ? `Email de mise à disposition envoyé pour ${data.number}.` : data.alreadyNotified ? `Le client a déjà été notifié pour ${data.number}.` : `Email non envoyé pour ${data.number}.`);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Opération impossible.");
    } finally {
      setWorkingId("");
    }
  }

  async function analyze() {
    if (!file) return;
    setWorking(true);
    setError("");
    setMessage("");
    const form = new FormData();
    form.set("action", "recognize");
    form.set("file", file);
    try {
      const response = await fetch("/api/admin/invoices", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analyse impossible.");
      setRecognition(data);
      setOrders(data.orders || orders);
      setOrderId(data.match?.id || "");
      setInvoiceNumber(data.invoiceNumberSuggestion || "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Analyse impossible.");
    } finally {
      setWorking(false);
    }
  }

  async function confirm() {
    if (!file || !orderId) return;
    const selected = orders.find((order) => order.id === orderId);
    if (!selected || !window.confirm(`Publier ${file.name} pour ${selected.customer.company || selected.customer.email} · commande ${selected.reference} ?\n\nLe client sera notifié immédiatement par email.`)) return;
    setWorking(true);
    setError("");
    setMessage("");
    const form = new FormData();
    form.set("action", "confirm");
    form.set("file", file);
    form.set("orderId", orderId);
    form.set("invoiceNumber", invoiceNumber);
    try {
      const response = await fetch("/api/admin/invoices", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Import impossible.");
      setMessage(`Facture enregistrée pour ${data.orderReference}. ${data.emailSent ? `Email envoyé à ${data.customerEmail}.` : "Facture disponible, mais email non envoyé."}`);
      setFile(null);
      setRecognition(null);
      setOrderId("");
      setInvoiceNumber("");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Import impossible.");
    } finally {
      setWorking(false);
    }
  }

  const selected = useMemo(() => orders.find((order) => order.id === orderId) || null, [orders, orderId]);

  return <div className="space-y-6">
    <section className="rounded-[1.6rem] border border-emerald-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><ReceiptText size={24}/></span>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-orange-600">Facturation V2 · OYSTE / ADEI</p>
          <h2 className="mt-1 text-xl font-black">Facturation automatisée</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Préparez le brouillon depuis une commande payée, émettez son numéro définitif, générez le PDF puis publiez-le dans l’espace client. La publication met la facture à disposition dans l’espace client et envoie automatiquement un email de notification, sans pièce jointe.</p>
        </div>
      </div>

      {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</div> : null}
      {message ? <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-black text-emerald-800"><CheckCircle2 size={16}/>{message}</div> : null}

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
        {automationOrders.length ? <div className="divide-y divide-slate-100">{automationOrders.map((order) => {
          const invoice = order.invoice;
          const busy = workingId === (invoice?.id || order.id);
          return <div key={order.id} className="grid gap-4 bg-white px-5 py-4 xl:grid-cols-[1.2fr_1fr_.65fr_auto] xl:items-center">
            <div>
              <p className="font-black text-slate-950">{order.reference}</p>
              <p className="mt-1 text-xs text-slate-500">{order.customer.company || order.customer.email} · {order.customer.email}</p>
            </div>
            <div>
              <p className="text-sm font-black">{euro(order.totalTtc, order.currency)}</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">Paiement validé</p>
            </div>
            <div>
              {!invoice ? <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-600">À préparer</span> : null}
              {invoice?.status === "DRAFT" ? <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black text-amber-700">Brouillon</span> : null}
              {invoice?.status === "ISSUED" ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-700">{invoice.number}</span> : null}
              {invoice?.pdfReady ? <p className="mt-2 text-[10px] font-bold text-cyan-700">PDF généré · {invoice.publishedAt ? "publié client" : "privé BO"}</p> : null}
            </div>
            <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
              {!invoice ? <button disabled={busy} onClick={()=>void runAutomation("auto-create", { orderId: order.id })} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">{busy ? <Loader2 size={14} className="animate-spin"/> : <FileCheck2 size={14}/>}Créer brouillon</button> : null}
              {invoice?.status === "DRAFT" ? <button disabled={busy} onClick={()=>void runAutomation("auto-issue", { invoiceId: invoice.id }, `Émettre définitivement la facture de ${order.reference} ?\n\nCette action consommera le prochain numéro OYS et ne doit pas être annulée.`)} className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">{busy ? <Loader2 size={14} className="animate-spin"/> : <Stamp size={14}/>}Émettre</button> : null}
              {invoice?.status === "ISSUED" && !invoice.pdfReady ? <button disabled={busy} onClick={()=>void runAutomation("auto-generate-pdf", { invoiceId: invoice.id })} className="inline-flex items-center gap-2 rounded-xl bg-[#007f8f] px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">{busy ? <Loader2 size={14} className="animate-spin"/> : <FileText size={14}/>}Générer PDF</button> : null}
              {invoice?.pdfReady ? <a href={`/api/admin/invoices/${invoice.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#007f8f] px-4 py-2.5 text-xs font-black text-white"><Download size={14}/>Voir PDF</a> : null}
              {invoice?.status === "ISSUED" && invoice.pdfReady && !invoice.publishedAt ? <button disabled={busy} onClick={()=>void runAutomation("auto-publish", { invoiceId: invoice.id }, `Publier définitivement ${invoice.number || "cette facture"} dans l’espace client ?\n\nLe client pourra la consulter et la télécharger. Un email de mise à disposition lui sera envoyé automatiquement, sans pièce jointe.`)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">{busy ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle2 size={14}/>}Publier au client</button> : null}
              {invoice?.publishedAt ? <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-xs font-black text-emerald-700"><CheckCircle2 size={14}/>Publié client</span> : null}
              {invoice?.publishedAt && invoice.notifiedAt ? <span className="inline-flex items-center gap-2 rounded-xl bg-cyan-50 px-4 py-2.5 text-xs font-black text-cyan-700"><MailCheck size={14}/>Email envoyé</span> : null}
              {invoice?.publishedAt && !invoice.notifiedAt ? <button disabled={busy} onClick={()=>void runAutomation("auto-notify", { invoiceId: invoice.id })} className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">{busy ? <Loader2 size={14} className="animate-spin"/> : <MailCheck size={14}/>}Envoyer l’email</button> : null}
            </div>
          </div>;
        })}</div> : <div className="p-8 text-center text-sm text-slate-400">Aucune commande payée récente à facturer.</div>}
      </div>
    </section>

    <section className="rounded-[1.6rem] border border-cyan-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-[#007f8f]"><UploadCloud size={24}/></span><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-orange-600">Mode historique · secours</p><h2 className="mt-1 text-xl font-black">Déposer une facture PDF manuelle</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Ce parcours historique reste disponible en secours. Une facture confirmée ici est immédiatement publiée dans l’espace client et une notification email est tentée.</p></div></div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto]"><label className="flex min-h-28 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-5 text-center hover:border-cyan-300"><input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e)=>{ setFile(e.target.files?.[0] || null); setRecognition(null); setOrderId(""); setMessage(""); setError(""); }}/><div><FileText size={26} className="mx-auto text-slate-400"/><p className="mt-2 text-sm font-black text-slate-800">{file ? file.name : "Choisir ou déposer un PDF"}</p><p className="mt-1 text-xs text-slate-400">PDF uniquement · 12 Mo maximum</p></div></label><button onClick={()=>void analyze()} disabled={!file || working} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-4 text-xs font-black text-white disabled:opacity-40">{working ? <Loader2 size={17} className="animate-spin"/> : <FileSearch size={17}/>}Analyser et reconnaître</button></div>

      {recognition ? <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase text-slate-400">Résultat du rapprochement</p><p className="mt-1 text-sm font-black">{recognition.match ? `Correspondance proposée : ${recognition.match.reference}` : recognition.ambiguous ? "Plusieurs correspondances possibles" : "Aucune correspondance certaine"}</p>{recognition.match?.reasons?.length ? <p className="mt-1 text-xs text-emerald-700">{recognition.match.reasons.join(" · ")}</p> : null}</div>{recognition.match ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black text-emerald-800">Score {recognition.match.score}</span> : null}</div>
        <div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-xs font-black text-slate-600">Commande / client<select value={orderId} onChange={(e)=>setOrderId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-bold"><option value="">Sélectionner…</option>{orders.map((order)=><option key={order.id} value={order.id}>{order.reference} · {order.customer.company || order.customer.email} · {order.customer.email}</option>)}</select></label><label className="text-xs font-black text-slate-600">N° de facture<input value={invoiceNumber} onChange={(e)=>setInvoiceNumber(e.target.value)} placeholder="Ex. FA-2026-001245" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-bold"/></label></div>
        {selected ? <div className="mt-4 rounded-xl bg-white p-4 text-xs"><strong>{selected.customer.company || `${selected.customer.firstName || ""} ${selected.customer.lastName || ""}`}</strong><span className="mx-2 text-slate-300">·</span>{selected.customer.email}<span className="mx-2 text-slate-300">·</span>{selected.reference}</div> : null}
        <button onClick={()=>void confirm()} disabled={!file || !orderId || working} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-xs font-black text-white disabled:opacity-40"><MailCheck size={16}/>Valider, publier et notifier le client</button>
      </div> : null}
    </section>

    <section className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-5"><h2 className="text-lg font-black">Factures récentes</h2><p className="mt-1 text-xs text-slate-500">Les PDF générés automatiquement restent privés au BO jusqu’à leur publication explicite dans l’espace client.</p></div>
      {invoices.length ? <div className="divide-y divide-slate-100">{invoices.map((invoice)=><div key={invoice.id} className="grid gap-3 px-6 py-4 md:grid-cols-[1fr_1fr_auto] md:items-center"><div><p className="font-black">{invoice.number || invoice.filename || "Brouillon sans numéro"}</p><p className="mt-1 text-xs text-slate-400">Commande {invoice.order.reference} · {invoiceStatusLabel(invoice.status)}</p></div><div className="text-xs"><p className="font-bold">{invoice.customer.company || invoice.customer.email}</p><p className="mt-1 text-slate-400">{invoice.customer.email}</p></div><div className="flex items-center gap-2">{invoice.pdfReady ? <a href={`/api/admin/invoices/${invoice.id}`} target="_blank" rel="noreferrer" className="rounded-full bg-cyan-50 px-3 py-1 text-[10px] font-black text-cyan-700">PDF BO</a> : null}<span className={`rounded-full px-3 py-1 text-[10px] font-black ${invoice.publishedAt ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{invoice.publishedAt ? "Publié client" : "Privé BO"}</span>{invoice.notifiedAt ? <span className="rounded-full bg-cyan-50 px-3 py-1 text-[10px] font-black text-cyan-700">Email envoyé</span> : null}</div></div>)}</div> : <div className="p-10 text-center text-sm text-slate-400">Aucune facture pour le moment.</div>}
    </section>
  </div>;
}
