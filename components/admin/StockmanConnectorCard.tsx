"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, LoaderCircle, PackageSearch, RefreshCw, Scale, Warehouse } from "lucide-react";
import type { StockmanConnectionStatus, StockmanProduct, StockmanSessionHealth, StockmanSyncResult } from "@/lib/suppliers/stockman/types";

const DEMO_URL = "https://www.stockman.fr/fr/coins-roulants-et-rouleurs--3/rouleurs-avec-galets--85/--1/rouleur-avec-galets-pivotants-1000-kg--SC%20N.aspx?langue=FR&src=int";

export default function StockmanConnectorCard({ status }: { status: StockmanConnectionStatus }) {
  const [reference, setReference] = useState("SC102N");
  const [productUrl, setProductUrl] = useState(DEMO_URL);
  const [product, setProduct] = useState<StockmanProduct | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<StockmanSyncResult | null>(null);
  const [sessionHealth, setSessionHealth] = useState<StockmanSessionHealth | null>(null);
  const [checkingSession, setCheckingSession] = useState(false);
  const [authJobId, setAuthJobId] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  async function refreshSessionHealth() {
    setCheckingSession(true);
    try {
      const response = await fetch("/api/admin/suppliers/stockman/auth", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Vérification de la session impossible.");
      setSessionHealth(payload);
    } catch (error) {
      setSessionHealth({
        state: "expired",
        valid: false,
        message: error instanceof Error ? error.message : "Vérification de la session impossible.",
      });
    } finally {
      setCheckingSession(false);
    }
  }

  useEffect(() => {
    void refreshSessionHealth();
  }, []);

  async function startReconnect() {
    setAuthBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/suppliers/stockman/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Impossible d’ouvrir Stockman.");
      setAuthJobId(payload.jobId);
      setMessage("La fenêtre Stockman est ouverte. Connectez-vous jusqu’à voir les prix et stocks, puis cliquez sur « Valider la connexion ».");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible d’ouvrir Stockman.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function confirmReconnect() {
    if (!authJobId) return;
    setAuthBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/suppliers/stockman/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", jobId: authJobId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Connexion revendeur non validée.");
      setAuthJobId(null);
      setMessage(payload.message || "Session Stockman reconnectée.");
      await refreshSessionHealth();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Connexion revendeur non validée.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setProduct(null);
    setSyncResult(null);

    try {
      const response = await fetch("/api/admin/suppliers/stockman/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, productUrl }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "La lecture Stockman a échoué.");
      setProduct(payload.product);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "La lecture Stockman a échoué.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    if (!product) return;
    setSyncing(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/suppliers/stockman/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, productUrl }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "La synchronisation Stockman a échoué.");
      setProduct(payload.product);
      setSyncResult(payload.sync);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "La synchronisation Stockman a échoué.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section className="mt-7 overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-5 border-b border-slate-100 p-5 md:flex-row md:items-start md:justify-between md:p-6">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-[#007f8f]"><PackageSearch size={23} /></div>
          <div>
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-black">Connecteur Stockman</h2><span className="rounded-full bg-orange-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-orange-700">RC3 · Lecture & liaison produit</span></div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Lisez une fiche Stockman, puis synchronisez le prix d’achat, le stock et le poids avec la référence correspondante dans OYSTE.</p>
          </div>
        </div>
        <div className={`inline-flex items-center gap-2 self-start rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] ${
          sessionHealth?.valid ? "bg-emerald-50 text-emerald-700" : sessionHealth ? "bg-amber-50 text-amber-700" : status.configured ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-700"
        }`}>
          {sessionHealth?.valid ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {checkingSession ? "Vérification…" : sessionHealth?.valid ? "Session revendeur active" : sessionHealth?.state === "expired" ? "Session expirée" : status.configured ? "Session à vérifier" : "Configuration requise"}
        </div>
      </div>

      <div className="grid gap-6 p-5 md:p-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4 text-xs font-semibold leading-5 text-slate-600">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <strong className="text-slate-900">{status.authFile}</strong> · {sessionHealth?.message || status.message}
              </div>
              <button type="button" onClick={() => void refreshSessionHealth()} disabled={checkingSession || authBusy} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-700 disabled:opacity-50">
                <RefreshCw size={13} className={checkingSession ? "animate-spin" : ""} /> Vérifier
              </button>
            </div>
            {!sessionHealth?.valid ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="font-black text-amber-900">Connexion revendeur requise</p>
                <p className="mt-1 text-[11px] leading-5 text-amber-800">OYSTE peut ouvrir Chromium sur ce poste. Connectez-vous manuellement à Stockman : aucun mot de passe n’est enregistré par OYSTE.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!authJobId ? (
                    <button type="button" onClick={() => void startReconnect()} disabled={authBusy} className="rounded-lg bg-slate-950 px-3 py-2 text-[10px] font-black text-white disabled:opacity-50">
                      {authBusy ? "Ouverture…" : "Se reconnecter à Stockman"}
                    </button>
                  ) : (
                    <button type="button" onClick={() => void confirmReconnect()} disabled={authBusy} className="rounded-lg bg-[#007f8f] px-3 py-2 text-[10px] font-black text-white disabled:opacity-50">
                      {authBusy ? "Validation…" : "Valider la connexion"}
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
          <label className="block"><span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Référence fournisseur</span><input value={reference} onChange={(event) => setReference(event.target.value.toUpperCase())} placeholder="SC102N" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none transition focus:border-[#007f8f] focus:ring-4 focus:ring-cyan-50" /></label>
          <label className="block"><span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">URL de la fiche Stockman</span><input type="url" value={productUrl} onChange={(event) => setProductUrl(event.target.value)} placeholder="https://www.stockman.fr/fr/..." className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none transition focus:border-[#007f8f] focus:ring-4 focus:ring-cyan-50" /></label>
          <button type="submit" disabled={loading || (sessionHealth ? !sessionHealth.valid : !status.configured)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#007f8f] px-5 py-3.5 text-xs font-black text-white shadow-lg shadow-cyan-900/10 transition hover:bg-[#006c79] disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? <LoaderCircle size={17} className="animate-spin" /> : <RefreshCw size={17} />}{loading ? "Lecture de la fiche…" : "Tester cette référence"}
          </button>
          {message && <div className="flex gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700"><AlertCircle size={18} className="mt-0.5 shrink-0" /><span>{message}</span></div>}
        </form>

        <div className="min-h-[270px] rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-5">
          {!product ? <div className="flex h-full min-h-[230px] flex-col items-center justify-center text-center"><PackageSearch size={34} className="text-slate-300" /><p className="mt-4 text-sm font-black text-slate-600">Aucune lecture effectuée</p><p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">Le résultat apparaîtra ici. La base OYSTE ne sera modifiée qu’après confirmation avec le bouton de synchronisation.</p></div> : <div>
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600">Lecture réussie</p><h3 className="mt-2 text-xl font-black text-slate-950">{product.reference}</h3><p className="mt-1 text-sm leading-5 text-slate-500">{product.designation}</p></div><CheckCircle2 size={25} className="shrink-0 text-emerald-500" /></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3"><Result icon={Warehouse} label="Stock" value={`${product.stock}`} /><Result icon={Scale} label="Poids" value={product.weightKg === null ? "Non trouvé" : `${product.weightKg} kg`} /><Result icon={PackageSearch} label="Prix HT" value={product.purchasePriceExVat.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} /></div>
            <div className="mt-5 border-t border-slate-200 pt-4">
              <p className="text-[10px] font-bold text-slate-400">Lu le {new Date(product.readAt).toLocaleString("fr-FR")}</p>
              {syncResult ? (
                <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="text-xs font-black text-emerald-800">Synchronisation réussie</p>
                  <p className="mt-1 text-xs leading-5 text-emerald-700">{syncResult.name} ({syncResult.targetType === "variant" ? "variante" : "produit"}) a été mis à jour dans OYSTE.</p>
                  <p className="mt-2 text-[10px] font-bold text-emerald-600">Stock {syncResult.previous.stock} → {syncResult.current.stock} · Poids {syncResult.previous.weightKg ?? "—"} → {syncResult.current.weightKg ?? "—"} kg · Achat {syncResult.previous.purchasePriceExVat?.toLocaleString("fr-FR", { style: "currency", currency: "EUR" }) ?? "—"} → {syncResult.current.purchasePriceExVat.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</p>
                </div>
              ) : (
                <button type="button" onClick={handleSync} disabled={syncing} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                  {syncing ? <LoaderCircle size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  {syncing ? "Synchronisation en cours…" : "Synchroniser avec OYSTE"}
                </button>
              )}
              <a href={product.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-xs font-black text-[#007f8f] hover:underline">Ouvrir la fiche source <ExternalLink size={14} /></a>
            </div>
          </div>}
        </div>
      </div>
    </section>
  );
}

function Result({ icon: Icon, label, value }: { icon: typeof Warehouse; label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><Icon size={17} className="text-[#007f8f]" /><p className="mt-3 text-lg font-black text-slate-950">{value}</p><p className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p></div>;
}
