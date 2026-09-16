"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, Rocket, SearchCheck, WandSparkles } from "lucide-react";

type Row = {
  id: string;
  code: string;
  name: string;
  status: "DRAFT" | "PUBLISHED" | "HIDDEN" | "ARCHIVED";
  category: string | null;
  purchasePriceHT: number | null;
  productPriceHT: number;
  expectedSellingPriceHT: number | null;
  marginRuleValid: boolean;
  priceOnRequest: boolean;
  stock: number;
  stockOnRequest: boolean;
  weightKg: number | null;
  hasImage: boolean;
  hasDocument: boolean;
  hasFeatures: boolean;
  variants: number;
  blockers: string[];
  warnings: string[];
  eligible: boolean;
};

type Audit = {
  version: string;
  supplier: { id: string; name: string };
  total: number;
  alreadyPublished: number;
  drafts: number;
  importedDrafts: number;
  eligible: number;
  blocked: number;
  missingCategories: number;
  zeroPriceSafe: number;
  pricingErrors: number;
  warningCount: number;
  rows: Row[];
};

export default function StockmanPublicationAuditCard() {
  const router = useRouter();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [working, setWorking] = useState<"audit" | "repair" | "publish" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function runAudit() {
    setWorking("audit");
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/suppliers/stockman/publication-audit", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Audit impossible.");
      setAudit(payload as Audit);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Audit impossible.");
    } finally {
      setWorking(null);
    }
  }

  async function repairCategories() {
    setWorking("repair");
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/suppliers/stockman/publication-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "repair_categories" }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Finalisation des catégories impossible.");
      setMessage(payload.message || "Catégories finalisées.");
      setAudit(payload.audit as Audit);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Finalisation des catégories impossible.");
    } finally {
      setWorking(null);
    }
  }

  async function publishEligible() {
    if (!audit || audit.eligible <= 0) return;
    const expected = `PUBLIER STOCKMAN ${audit.eligible}`;
    const confirmation = window.prompt(
      `Publication STOCKMAN\n\n${audit.eligible} fiche(s) sont éligibles.\n${audit.blocked} fiche(s) resteront en l'état.\n\nTapez exactement ${expected} pour confirmer.`,
    );
    if (confirmation !== expected) return;

    setWorking("publish");
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/suppliers/stockman/publication-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Publication impossible.");
      setMessage(payload.message || "Publication terminée.");
      await runAudit();
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Publication impossible.");
    } finally {
      setWorking(null);
    }
  }

  const blockedRows = audit?.rows.filter((row) => row.status === "DRAFT" && !row.eligible) || [];
  const warningRows = audit?.rows.filter((row) => row.status === "DRAFT" && row.eligible && row.warnings.length > 0) || [];

  return (
    <section className="rounded-[1.4rem] border border-violet-200 bg-violet-50/50 p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <SearchCheck size={18} className="text-violet-700" />
            <h3 className="text-base font-black text-slate-950">Finalisation & publication STOCKMAN · V2.12.9</h3>
          </div>
          <p className="mt-2 max-w-4xl text-xs font-bold leading-5 text-slate-600">
            Audit final des brouillons : catégorie, contenu, médias, PA HT, PV HT = PA / 0,80, stock, poids, livraison incluse et délai STOCKMAN.
            Un prix technique à 0 € n’est accepté que pour un vrai « Nous consulter » et n’est jamais traité comme un prix vendable.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void repairCategories()}
            disabled={working !== null || (audit !== null && audit.missingCategories === 0)}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-xs font-black text-white disabled:opacity-40"
          >
            {working === "repair" ? <Loader2 size={15} className="animate-spin" /> : <WandSparkles size={15} />}
            Finaliser {audit?.missingCategories ?? 6} catégorie(s)
          </button>
          <button
            type="button"
            onClick={() => void runAudit()}
            disabled={working !== null}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-black text-white disabled:opacity-40"
          >
            {working === "audit" ? <Loader2 size={15} className="animate-spin" /> : <SearchCheck size={15} />}
            Auditer avant publication
          </button>
          <button
            type="button"
            onClick={() => void publishEligible()}
            disabled={working !== null || !audit || audit.eligible === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-3 text-xs font-black text-white disabled:opacity-40"
          >
            {working === "publish" ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />}
            Publier {audit?.eligible || 0} fiche(s)
          </button>
        </div>
      </div>

      {message ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-black text-emerald-800">{message}</div> : null}
      {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-black text-red-700">{error}</div> : null}

      {audit ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
            <Metric value={audit.importedDrafts} label="DRAFT importés" />
            <Metric value={audit.missingCategories} label="Catégories manquantes" />
            <Metric value={audit.eligible} label="Prêtes à publier" />
            <Metric value={audit.blocked} label="Bloquées" />
            <Metric value={audit.pricingErrors} label="Erreurs de prix" />
            <Metric value={audit.zeroPriceSafe} label="0 € sur devis" />
            <Metric value={audit.warningCount} label="Avec avertissement" />
          </div>

          {blockedRows.length ? (
            <details className="mt-4 overflow-hidden rounded-xl border border-red-200 bg-white" open>
              <summary className="cursor-pointer px-4 py-3 text-xs font-black text-red-800">
                <span className="inline-flex items-center gap-2"><AlertTriangle size={15} /> Voir les fiches bloquées ({blockedRows.length})</span>
              </summary>
              <div className="max-h-[360px] overflow-auto border-t border-red-100">
                {blockedRows.map((row) => (
                  <div key={row.id} className="border-b border-slate-100 p-4 last:border-b-0">
                    <p className="text-xs font-black text-slate-950">{row.code} · {row.name}</p>
                    <p className="mt-1 text-[10px] font-bold text-slate-500">{row.category || "Sans catégorie"} · PA {row.purchasePriceHT ?? "Nous consulter"} € · PV {row.productPriceHT.toFixed(2)} € · stock {row.stockOnRequest ? "Nous consulter" : row.stock}</p>
                    <p className="mt-2 text-[11px] font-bold text-red-700">{row.blockers.join(" · ")}</p>
                  </div>
                ))}
              </div>
            </details>
          ) : (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-black text-emerald-800">
              <CheckCircle2 size={17} /> Aucun blocage de publication détecté.
            </div>
          )}

          {warningRows.length ? (
            <details className="mt-3 overflow-hidden rounded-xl border border-amber-200 bg-white">
              <summary className="cursor-pointer px-4 py-3 text-xs font-black text-amber-800">
                Informations non bloquantes — devis / variantes ({warningRows.length})
              </summary>
              <div className="max-h-[300px] overflow-auto border-t border-amber-100">
                {warningRows.map((row) => (
                  <div key={row.id} className="border-b border-slate-100 p-4 last:border-b-0">
                    <p className="text-xs font-black text-slate-950">{row.code} · {row.name}</p>
                    <p className="mt-2 text-[11px] font-bold text-amber-700">{row.warnings.join(" · ")}</p>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-violet-100 bg-white px-4 py-4">
      <p className="text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}
