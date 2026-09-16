"use client";

import { useState } from "react";
import { CheckCircle2, Cloud, ExternalLink, LoaderCircle, RefreshCw, ShieldCheck, Truck, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { SendcloudConnectionStatus } from "@/lib/integrations/sendcloud";

function formatCheckedAt(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

export default function SendcloudIntegrationCard({ initialStatus }: { initialStatus: SendcloudConnectionStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [testing, setTesting] = useState(false);

  async function testConnection() {
    if (testing) return;
    setTesting(true);

    try {
      const response = await fetch("/api/admin/integrations/sendcloud", { cache: "no-store" });
      const payload = (await response.json()) as { status?: SendcloudConnectionStatus; message?: string };

      if (!response.ok || !payload.status) throw new Error(payload.message || "Le test de connexion a échoué.");

      setStatus(payload.status);
      if (payload.status.connected) toast.success("Connexion Sendcloud validée.");
      else toast.error(payload.status.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Le test de connexion a échoué.");
    } finally {
      setTesting(false);
    }
  }

  const state = !status.configured
    ? { label: "À configurer", classes: "bg-amber-50 text-amber-700", Icon: ShieldCheck }
    : status.connected
      ? { label: "Connecté", classes: "bg-emerald-50 text-emerald-700", Icon: CheckCircle2 }
      : { label: "Connexion en erreur", classes: "bg-red-50 text-red-700", Icon: XCircle };
  const StateIcon = state.Icon;

  return (
    <section className="overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-[#07131f] to-[#0d2b43] p-6 text-white md:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-300 ring-1 ring-cyan-300/20">
              <Cloud size={29} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.23em] text-cyan-300">Transport petits colis</p>
              <h2 className="mt-1 text-2xl font-black">Sendcloud</h2>
            </div>
          </div>
          <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-2 text-xs font-black ${state.classes}`}>
            <StateIcon size={16} /> {state.label}
          </span>
        </div>
      </div>

      <div className="p-6 md:p-7">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Clés API</p>
            <p className="mt-2 text-sm font-black text-slate-900">{status.configured ? "Détectées côté serveur" : "Non détectées"}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Les clés confidentielles ne sont jamais envoyées au navigateur.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Méthodes disponibles</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{status.connected ? status.methodsCount : "—"}</p>
            <p className="mt-1 text-xs text-slate-500">Services de livraison disponibles.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Transporteurs détectés</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{status.connected ? status.carriers.length : "—"}</p>
            <p className="mt-1 truncate text-xs text-slate-500">{status.carriers.slice(0, 3).map((carrier) => carrier.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())).join(" · ") || "Aucun transporteur remonté"}</p>
          </div>
        </div>

        <div className={`mt-5 rounded-2xl border p-4 ${status.connected ? "border-emerald-200 bg-emerald-50/70" : status.configured ? "border-red-200 bg-red-50/70" : "border-amber-200 bg-amber-50/70"}`}>
          <p className="text-sm font-black text-slate-900">{status.message}</p>
          <p className="mt-1 text-xs text-slate-500">Dernier test : {formatCheckedAt(status.checkedAt)}</p>
        </div>

        {status.sampleMethods.length > 0 ? (
          <div className="mt-6">
            <div className="flex items-center gap-2"><Truck size={18} className="text-cyan-700" /><h3 className="text-sm font-black">Aperçu des méthodes disponibles</h3></div>
            <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
              {status.sampleMethods.map((method, index) => (
                <div key={`${method.id ?? "method"}-${index}`} className="flex items-center justify-between gap-4 bg-white px-4 py-3 text-sm">
                  <span className="font-bold text-slate-800">{method.name}</span>
                  <span className="text-xs font-bold text-slate-400">{method.carrier ? method.carrier.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Transporteur non précisé"}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={testConnection} disabled={testing} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-black text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60">
            {testing ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {testing ? "Test en cours…" : "Tester la connexion"}
          </button>
          <a href="https://app.sendcloud.com/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-xs font-black text-slate-700 transition hover:bg-slate-50">
            Ouvrir Sendcloud <ExternalLink size={15} />
          </a>
        </div>
      </div>
    </section>
  );
}
