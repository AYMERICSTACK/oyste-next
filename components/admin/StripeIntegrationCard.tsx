"use client";

import { useState } from "react";
import {
  BadgeEuro,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  WalletCards,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { StripeConnectionStatus } from "@/lib/integrations/stripe";

function formatCheckedAt(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatMode(mode: StripeConnectionStatus["mode"]) {
  if (mode === "test") return "Environnement de test";
  if (mode === "live") return "Production";
  return "Mode indéterminé";
}

function Capability({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <span className="text-xs font-bold text-slate-700">{label}</span>
      <span className={`inline-flex items-center gap-1 text-[11px] font-black ${enabled ? "text-emerald-700" : "text-amber-700"}`}>
        {enabled ? <CheckCircle2 size={14} /> : <ShieldCheck size={14} />}
        {enabled ? "Actif" : "À finaliser"}
      </span>
    </div>
  );
}

export default function StripeIntegrationCard({ initialStatus }: { initialStatus: StripeConnectionStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [testing, setTesting] = useState(false);

  async function testConnection() {
    if (testing) return;
    setTesting(true);

    try {
      const response = await fetch("/api/admin/integrations/stripe", { cache: "no-store" });
      const payload = (await response.json()) as { status?: StripeConnectionStatus; message?: string };

      if (!response.ok || !payload.status) throw new Error(payload.message || "Le test de connexion a échoué.");

      setStatus(payload.status);
      if (payload.status.connected) toast.success("Connexion Stripe validée.");
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
      <div className="border-b border-slate-100 bg-gradient-to-r from-[#171126] via-[#33205f] to-[#635bff] p-6 text-white md:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/12 text-white ring-1 ring-white/20">
              <CreditCard size={29} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.23em] text-violet-200">Paiement en ligne</p>
              <h2 className="mt-1 text-2xl font-black">Stripe</h2>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-2 text-xs font-black ${status.mode === "test" ? "bg-sky-50 text-sky-700" : status.mode === "live" ? "bg-violet-50 text-violet-700" : "bg-white/10 text-white"}`}>
              <WalletCards size={15} /> {formatMode(status.mode)}
            </span>
            <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-2 text-xs font-black ${state.classes}`}>
              <StateIcon size={16} /> {state.label}
            </span>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-7">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Clés API</p>
            <p className="mt-2 text-sm font-black text-slate-900">{status.configured ? "Clé secrète détectée" : "Clé secrète absente"}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {status.publishableKeyConfigured ? "Clé publique détectée côté application." : "Clé publique à ajouter avant le checkout."}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Compte connecté</p>
            <p className="mt-2 truncate text-sm font-black text-slate-900">{status.accountName || "—"}</p>
            <p className="mt-1 truncate text-xs text-slate-500">{status.accountId || "Aucun compte remonté"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Configuration</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{status.currency || "—"}</p>
            <p className="mt-1 text-xs text-slate-500">{status.country ? `Compte ${status.country}` : "Pays non disponible"}</p>
          </div>
        </div>

        <div className={`mt-5 rounded-2xl border p-4 ${status.connected ? "border-emerald-200 bg-emerald-50/70" : status.configured ? "border-red-200 bg-red-50/70" : "border-amber-200 bg-amber-50/70"}`}>
          <p className="text-sm font-black text-slate-900">{status.message}</p>
          <p className="mt-1 text-xs text-slate-500">Dernier test : {formatCheckedAt(status.checkedAt)}</p>
        </div>

        {status.connected ? (
          <div className="mt-6">
            <div className="flex items-center gap-2">
              <BadgeEuro size={18} className="text-violet-700" />
              <h3 className="text-sm font-black">État du compte Stripe</h3>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Capability enabled={status.detailsSubmitted} label="Informations du compte" />
              <Capability enabled={status.chargesEnabled} label="Encaissements" />
              <Capability enabled={status.payoutsEnabled} label="Virements bancaires" />
            </div>
            {!status.keysModeMatch ? (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
                <KeyRound size={16} className="mt-0.5 shrink-0" />
                Les clés publique et secrète appartiennent à des environnements différents. Utilisez deux clés test ou deux clés production.
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={testConnection} disabled={testing} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-black text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60">
            {testing ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {testing ? "Test en cours…" : "Tester la connexion"}
          </button>
          <a href="https://dashboard.stripe.com/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-xs font-black text-slate-700 transition hover:bg-slate-50">
            Ouvrir Stripe <ExternalLink size={15} />
          </a>
        </div>
      </div>
    </section>
  );
}
