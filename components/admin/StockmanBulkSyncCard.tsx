"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CirclePause,
  Clock3,
  Download,
  History,
  Link2,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  Scale,
  TimerReset,
  Warehouse,
} from "lucide-react";
import type {
  StockmanBulkDashboard,
  StockmanBulkItemResult,
  StockmanBulkRunSummary,
  StockmanBulkTarget,
  StockmanSyncField,
} from "@/lib/suppliers/stockman/types";

const BATCH_SIZE = 5;
const LAST_RUN_KEY = "oyste.stockman.lastBulkRun";
const FIELD_OPTIONS: Array<{ key: StockmanSyncField; label: string; icon: typeof Warehouse }> = [
  { key: "price", label: "Prix d’achat", icon: RefreshCw },
  { key: "stock", label: "Stocks", icon: Warehouse },
  { key: "weight", label: "Poids", icon: Scale },
];

type JournalFilter = "all" | StockmanBulkItemResult["status"];

const EMPTY_DASHBOARD: StockmanBulkDashboard = {
  linked: 0,
  synchronized: 0,
  neverSynchronized: 0,
  stale: 0,
  latestSyncAt: null,
};

export default function StockmanBulkSyncCard({ enabled }: { enabled: boolean }) {
  const [targets, setTargets] = useState<StockmanBulkTarget[]>([]);
  const [dashboard, setDashboard] = useState<StockmanBulkDashboard>(EMPTY_DASHBOARD);
  const [fields, setFields] = useState<StockmanSyncField[]>(["price", "stock", "weight"]);
  const [results, setResults] = useState<StockmanBulkItemResult[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [running, setRunning] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
  const stopRequestedRef = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const [currentReferences, setCurrentReferences] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [totalAtStart, setTotalAtStart] = useState(0);
  const [lastRun, setLastRun] = useState<StockmanBulkRunSummary | null>(null);
  const [journalFilter, setJournalFilter] = useState<JournalFilter>("all");

  const loadTargets = useCallback(async () => {
    setLoadingTargets(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/suppliers/stockman/bulk", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Impossible de charger les produits liés à Stockman.");
      setTargets(payload.targets ?? []);
      setDashboard(payload.dashboard ?? EMPTY_DASHBOARD);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chargement impossible.");
    } finally {
      setLoadingTargets(false);
    }
  }, []);

  useEffect(() => {
    void loadTargets();
    try {
      const saved = window.localStorage.getItem(LAST_RUN_KEY);
      if (saved) setLastRun(JSON.parse(saved) as StockmanBulkRunSummary);
    } catch {
      window.localStorage.removeItem(LAST_RUN_KEY);
    }
  }, [loadTargets]);

  const summary = useMemo(() => ({
    processed: results.length,
    updated: results.filter((item) => item.status === "updated").length,
    unchanged: results.filter((item) => item.status === "unchanged").length,
    errors: results.filter((item) => item.status === "error").length,
  }), [results]);

  const runTotal = running || results.length > 0 ? totalAtStart : targets.length;
  const progress = runTotal ? Math.min(100, Math.round((summary.processed / runTotal) * 100)) : 0;
  const estimatedRemaining = useMemo(() => {
    if (!running || !startedAt || summary.processed === 0 || runTotal <= summary.processed) return null;
    const elapsedSeconds = (Date.now() - startedAt) / 1_000;
    return Math.max(1, Math.round((elapsedSeconds / summary.processed) * (runTotal - summary.processed)));
  }, [running, startedAt, summary.processed, runTotal]);

  const filteredResults = useMemo(
    () => journalFilter === "all" ? results : results.filter((item) => item.status === journalFilter),
    [journalFilter, results],
  );

  function toggleField(field: StockmanSyncField) {
    if (running) return;
    setFields((current) => current.includes(field)
      ? current.filter((item) => item !== field)
      : [...current, field]);
  }

  async function runSync() {
    if (!enabled || !fields.length || !targets.length) return;

    const initialTargets = [...targets];
    const runStartedAt = Date.now();
    setRunning(true);
    setStopRequested(false);
    stopRequestedRef.current = false;
    setResults([]);
    setMessage(null);
    setCurrentReferences([]);
    setStartedAt(runStartedAt);
    setTotalAtStart(initialTargets.length);
    setJournalFilter("all");

    let finalResults: StockmanBulkItemResult[] = [];

    for (let index = 0; index < initialTargets.length; index += BATCH_SIZE) {
      if (stopRequestedRef.current) break;
      const batch = initialTargets.slice(index, index + BATCH_SIZE);
      setCurrentReferences(batch.map((target) => target.reference));

      let batchResults: StockmanBulkItemResult[];
      try {
        const response = await fetch("/api/admin/suppliers/stockman/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields, targets: batch }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "Le lot Stockman a échoué.");
        batchResults = payload.results ?? [];
      } catch (error) {
        const failure = error instanceof Error ? error.message : "Le lot Stockman a échoué.";
        batchResults = batch.map((target) => ({
          target,
          status: "error" as const,
          changedFields: [],
          message: failure,
        }));
      }

      finalResults = [...finalResults, ...batchResults];
      setResults(finalResults);
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }

    const runFinishedAt = Date.now();
    const finalSummary: StockmanBulkRunSummary = {
      startedAt: new Date(runStartedAt).toISOString(),
      finishedAt: new Date(runFinishedAt).toISOString(),
      durationSeconds: Math.max(0, Math.round((runFinishedAt - runStartedAt) / 1_000)),
      total: initialTargets.length,
      processed: finalResults.length,
      updated: finalResults.filter((item) => item.status === "updated").length,
      unchanged: finalResults.filter((item) => item.status === "unchanged").length,
      errors: finalResults.filter((item) => item.status === "error").length,
      stopped: stopRequestedRef.current,
    };

    setLastRun(finalSummary);
    window.localStorage.setItem(LAST_RUN_KEY, JSON.stringify(finalSummary));
    setRunning(false);
    setCurrentReferences([]);
    setStartedAt(null);
    await loadTargets();
  }

  function exportJournal() {
    if (!results.length) return;
    const lines = [
      ["Référence", "Produit", "Type", "Statut", "Champs modifiés", "Message"],
      ...results.map((item) => [
        item.target.reference,
        item.target.name,
        item.target.targetType === "variant" ? "Variante" : "Produit",
        item.status === "updated" ? "Mis à jour" : item.status === "unchanged" ? "Inchangé" : "Erreur",
        item.changedFields.map(fieldLabel).join(" | "),
        item.message ?? "",
      ]),
    ];
    const csv = lines.map((line) => line.map(csvCell).join(";")).join("\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `stockman-synchronisation-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mt-7 overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 md:flex-row md:items-start md:justify-between md:p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black">Pilotage Stockman</h2>
            <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-cyan-700">RC3 · Catalogue lié</span>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Suivez l’état des liaisons fournisseur, puis actualisez le prix d’achat, le stock et le poids sans réécriture inutile.</p>
        </div>
        <button type="button" onClick={() => void loadTargets()} disabled={running || loadingTargets} className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-600 hover:border-[#007f8f] hover:text-[#007f8f] disabled:opacity-50">
          <RotateCcw size={15} className={loadingTargets ? "animate-spin" : ""} />Actualiser le tableau de bord
        </button>
      </div>

      <div className="p-5 md:p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <DashboardMetric icon={Link2} label="Références liées" value={loadingTargets ? "…" : dashboard.linked} />
          <DashboardMetric icon={PackageCheck} label="Déjà synchronisées" value={loadingTargets ? "…" : dashboard.synchronized} />
          <DashboardMetric icon={TimerReset} label="Jamais synchronisées" value={loadingTargets ? "…" : dashboard.neverSynchronized} tone={dashboard.neverSynchronized ? "warning" : "default"} />
          <DashboardMetric icon={Clock3} label="À revoir (+7 jours)" value={loadingTargets ? "…" : dashboard.stale} tone={dashboard.stale ? "warning" : "default"} />
          <DashboardMetric
            icon={History}
            label="Dernière synchro"
            value={dashboard.latestSyncAt ? formatRelativeDate(dashboard.latestSyncAt) : "Jamais"}
            detail={dashboard.latestSyncAt ? formatFullDate(dashboard.latestSyncAt) : undefined}
          />
        </div>

        {lastRun ? (
          <div className={`mt-4 flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between ${lastRun.errors ? "border-amber-200 bg-amber-50" : "border-emerald-100 bg-emerald-50"}`}>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Dernière exécution sur ce navigateur</p>
              <p className="mt-1 text-sm font-black text-slate-900">{lastRun.processed}/{lastRun.total} traitées{lastRun.stopped ? " · arrêtée manuellement" : ""}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold text-slate-500">
                <span>Début : {lastRun.startedAt ? formatTime(lastRun.startedAt) : "—"}</span>
                <span>Fin : {formatTime(lastRun.finishedAt)}</span>
                <span>Durée : {formatDuration(lastRun.durationSeconds ?? 0)}</span>
              </div>
            </div>
            <p className="text-xs font-bold text-slate-600">{lastRun.updated} mises à jour · {lastRun.unchanged} inchangées · {lastRun.errors} erreurs</p>
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {FIELD_OPTIONS.map(({ key, label, icon: Icon }) => {
            const active = fields.includes(key);
            return (
              <button key={key} type="button" onClick={() => toggleField(key)} disabled={running} className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${active ? "border-cyan-200 bg-cyan-50 text-[#006c79]" : "border-slate-200 bg-white text-slate-500"}`}>
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? "bg-white" : "bg-slate-50"}`}><Icon size={18} /></span>
                <span><strong className="block text-sm font-black">{label}</strong><span className="mt-1 block text-[10px] font-bold uppercase tracking-wide">{active ? "✓ Activé" : "Ignoré"}</span></span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 rounded-2xl bg-slate-950 p-5 text-white">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">Synchronisation de masse</p>
              <p className="mt-2 text-3xl font-black">{loadingTargets ? "…" : targets.length}</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">{targets.length === 1 ? "produit lié au fournisseur Stockman" : "produits liés au fournisseur Stockman"}</p>
            </div>
            {!running ? (
              <button type="button" onClick={() => void runSync()} disabled={!enabled || loadingTargets || !targets.length || !fields.length} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#00a1b5] px-5 py-3.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><RefreshCw size={17} />Synchroniser le catalogue lié</button>
            ) : (
              <button type="button" onClick={() => { stopRequestedRef.current = true; setStopRequested(true); }} disabled={stopRequested} className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3.5 text-xs font-black text-white disabled:opacity-50"><CirclePause size={17} />{stopRequested ? "Arrêt après ce lot…" : "Arrêter après ce lot"}</button>
            )}
          </div>

          {running ? (
            <div className="mt-5">
              <div className="mb-2 flex flex-wrap justify-between gap-2 text-[10px] font-black uppercase tracking-wide text-slate-400">
                <span>{summary.processed} / {runTotal} analysés</span>
                <span>{currentReferences.length ? `Lot : ${currentReferences.join(", ")}` : `${progress}%`}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${progress}%` }} /></div>
              <p className="mt-2 text-[10px] font-semibold text-slate-400">{estimatedRemaining ? `Temps restant estimé : ${formatDuration(estimatedRemaining)}` : "Estimation en cours…"}</p>
            </div>
          ) : results.length > 0 ? (
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4">
              <CheckCircle2 size={20} className="shrink-0 text-emerald-300" />
              <div>
                <p className="text-xs font-black text-white">Synchronisation terminée</p>
                <p className="mt-1 text-[10px] font-semibold text-slate-300">{summary.processed} {summary.processed > 1 ? "produits analysés" : "produit analysé"} · {summary.updated} mis à jour · {summary.unchanged} inchangé{summary.unchanged > 1 ? "s" : ""} · {summary.errors} erreur{summary.errors > 1 ? "s" : ""}</p>
              </div>
            </div>
          ) : null}
        </div>

        {message ? <div className="mt-4 flex gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700"><AlertCircle size={18} className="shrink-0" />{message}</div> : null}

        {results.length > 0 ? (
          <div className="mt-5">
            <div className="grid gap-3 sm:grid-cols-4"><Metric label="Analysés" value={summary.processed} /><Metric label="Mis à jour" value={summary.updated} /><Metric label="Inchangés" value={summary.unchanged} /><Metric label="Erreurs" value={summary.errors} /></div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <FilterButton active={journalFilter === "all"} onClick={() => setJournalFilter("all")}>Tout ({results.length})</FilterButton>
                <FilterButton active={journalFilter === "updated"} onClick={() => setJournalFilter("updated")}>Mis à jour ({summary.updated})</FilterButton>
                <FilterButton active={journalFilter === "unchanged"} onClick={() => setJournalFilter("unchanged")}>Inchangés ({summary.unchanged})</FilterButton>
                <FilterButton active={journalFilter === "error"} onClick={() => setJournalFilter("error")}>Erreurs ({summary.errors})</FilterButton>
              </div>
              <button type="button" onClick={exportJournal} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-600 hover:border-[#007f8f] hover:text-[#007f8f]"><Download size={15} />Exporter le journal</button>
            </div>

            <div className="mt-3 max-h-[420px] overflow-auto rounded-2xl border border-slate-200">
              {filteredResults.map((item, index) => (
                <div key={`${item.target.targetId}-${index}`} className="flex items-start gap-3 border-b border-slate-100 p-4 last:border-0">
                  {item.status === "error" ? <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" /> : item.status === "updated" ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-slate-300" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2"><p className="truncate text-sm font-black text-slate-900">{item.target.reference} · {item.target.name}</p><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${item.status === "error" ? "bg-red-50 text-red-700" : item.status === "updated" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{item.status === "error" ? "Erreur" : item.status === "updated" ? "Mis à jour" : "Inchangé"}</span></div>
                    <p className="mt-1 text-xs text-slate-500">{item.status === "error" ? item.message : item.changedFields.length ? `Modifié : ${item.changedFields.map(fieldLabel).join(", ")}` : "Aucune différence détectée."}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DashboardMetric({ icon: Icon, label, value, detail, tone = "default" }: { icon: typeof Warehouse; label: string; value: string | number; detail?: string; tone?: "default" | "warning" }) {
  return <div className={`rounded-2xl border p-4 ${tone === "warning" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}><Icon size={17} className={tone === "warning" ? "text-amber-600" : "text-[#007f8f]"} /><p className="mt-3 text-xl font-black text-slate-950">{value}</p>{detail ? <p className="mt-1 text-[10px] font-bold text-slate-500">{detail}</p> : null}<p className="mt-1 text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</p></div>;
}
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-slate-50 p-4"><p className="text-2xl font-black text-slate-950">{value}</p><p className="mt-1 text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</p></div>; }
function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) { return <button type="button" onClick={onClick} className={`rounded-full px-3 py-2 text-[10px] font-black ${active ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{children}</button>; }
function fieldLabel(field: StockmanSyncField) { return field === "price" ? "prix" : field === "stock" ? "stock" : "poids"; }
function formatRelativeDate(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (minutes < 1) return "À l’instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days} jour${days > 1 ? "s" : ""}`;
}
function formatFullDate(value: string) { return new Date(value).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
function formatTime(value: string) { return new Date(value).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
function formatDuration(seconds: number) { if (seconds < 60) return `${seconds} s`; const minutes = Math.floor(seconds / 60); const remaining = seconds % 60; return remaining ? `${minutes} min ${remaining} s` : `${minutes} min`; }
function csvCell(value: string) { return `"${value.replaceAll('"', '""')}"`; }
