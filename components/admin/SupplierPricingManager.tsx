"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calculator,
  CheckCircle2,
  CircleDollarSign,
  DatabaseZap,
  Loader2,
  Percent,
  RefreshCw,
  Save,
  ShieldCheck,
  TrendingUp,
  TriangleAlert,
  ChevronDown,
} from "lucide-react";

type Rule = {
  marginRate: number;
  purchaseAdjustmentRate: number;
  updatedAt?: string | null;
};

type Supplier = {
  id: string;
  name: string;
  isActive: boolean;
  productCount: number;
  rule: Rule;
};

type PricingLine = {
  targetType: "product" | "variant";
  id: string;
  code: string;
  name: string;
  purchasePriceHT: number;
  currentSellingPriceHT: number;
  proposedSellingPriceHT: number;
  currentMarginRate: number | null;
};

type MissingPricingLine = {
  targetType: "product" | "variant";
  id: string;
  code: string;
  name: string;
  reason: string;
  detail: string | null;
  classification: "parent_with_variants" | "supplier_consult" | "catalog_link_missing" | "stockman_inactive" | "source_url_missing" | "real_anomaly" | "generic_missing";
  blocking: boolean;
};

type Preview = {
  supplier: { id: string; name: string };
  rule: Rule;
  affectedCount: number;
  missingPurchasePrice: number;
  blockingMissingPurchasePrice: number;
  validNoPriceCount: number;
  missingBreakdown: { parentWithVariants: number; supplierConsult: number; catalogLinkMissing: number; realAnomaly: number };
  missingLines: MissingPricingLine[];
  lines: PricingLine[];
};

type DecisionMode = "current" | "calculated" | "manual";

type Decision = {
  mode: DecisionMode;
  manualPrice: string;
};

const formatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

function money(value: number) {
  return formatter.format(value);
}

function marginLabel(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} %`;
}

function needsPurchasePriceReview(line: PricingLine) {
  return (
    line.currentSellingPriceHT > 0 &&
    line.currentMarginRate !== null &&
    Number.isFinite(line.currentMarginRate) &&
    line.currentMarginRate >= 70
  );
}

function retainedPrice(line: PricingLine, decision: Decision) {
  if (decision.mode === "current") return line.currentSellingPriceHT;
  if (decision.mode === "calculated") return line.proposedSellingPriceHT;
  const manual = Number(decision.manualPrice.replace(",", "."));
  return Number.isFinite(manual) && manual > 0 ? manual : 0;
}

export default function SupplierPricingManager({
  supplierName,
  lockSupplier = false,
}: {
  supplierName?: string;
  lockSupplier?: boolean;
}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [marginRate, setMarginRate] = useState("25");
  const [adjustmentRate, setAdjustmentRate] = useState("0");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<"preview" | "save" | "apply" | "backfill" | null>(null);
  const [backfillProgress, setBackfillProgress] = useState<{
    updated: number;
    skipped: number;
    failed: number;
    remaining: number | null;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [showMissingPrices, setShowMissingPrices] = useState(false);
  const [commercialWorking, setCommercialWorking] = useState(false);
  const [commercialMessage, setCommercialMessage] = useState("");

  const selected = useMemo(
    () => suppliers.find((supplier) => supplier.id === selectedId) ?? null,
    [selectedId, suppliers],
  );

  async function finalizeStockmanCommercialRules() {
    if (!selected || selected.name.trim().toLocaleUpperCase("fr") !== "STOCKMAN") return;
    const confirmation = window.prompt(
      "Finalisation commerciale STOCKMAN\n\n" +
      "Cette action applique à tous les produits et variantes STOCKMAN :\n" +
      "• Livraison incluse\n" +
      "• Départ usine sous 48 h si stock disponible\n" +
      "• Mention explicite : délai de départ usine, pas délai de livraison\n\n" +
      "Tapez exactement STOCKMAN 48H pour confirmer.",
    );
    if (confirmation !== "STOCKMAN 48H") return;

    setCommercialWorking(true);
    setCommercialMessage("");
    try {
      const response = await fetch("/api/admin/suppliers/stockman/commercial-finalization", {
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Finalisation commerciale impossible.");
      setCommercialMessage(payload.message || "Règles commerciales STOCKMAN appliquées.");
    } catch (error) {
      setCommercialMessage(error instanceof Error ? error.message : "Finalisation commerciale impossible.");
    } finally {
      setCommercialWorking(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/suppliers/pricing", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Chargement impossible.");

      const list = Array.isArray(payload.suppliers) ? payload.suppliers as Supplier[] : [];
      setSuppliers(list);
      setSelectedId((current) => {
        if (supplierName) {
          const normalized = supplierName.trim().toLocaleLowerCase("fr");
          const contextual = list.find(
            (supplier) => supplier.name.trim().toLocaleLowerCase("fr") === normalized,
          );
          if (contextual) return contextual.id;
        }
        return current && list.some((supplier) => supplier.id === current)
          ? current
          : list[0]?.id || "";
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, [supplierName]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    setMarginRate(String(selected.rule.marginRate));
    setAdjustmentRate(String(selected.rule.purchaseAdjustmentRate));
    setPreview(null);
    setDecisions({});
    setMessage("");
  }, [selected]);

  function currentRule(): Rule | null {
    const margin = Number(marginRate.replace(",", "."));
    const adjustment = Number(adjustmentRate.replace(",", "."));

    if (!Number.isFinite(margin) || margin < 0 || margin >= 100) {
      setMessage("La marge doit être comprise entre 0 % et 99,99 %.");
      return null;
    }
    if (!Number.isFinite(adjustment) || adjustment <= -100) {
      setMessage("La révision fournisseur doit rester supérieure à -100 %.");
      return null;
    }

    return { marginRate: margin, purchaseAdjustmentRate: adjustment };
  }

  function initializeDecisions(nextPreview: Preview) {
    setDecisions(
      Object.fromEntries(
        nextPreview.lines.map((line) => [
          `${line.targetType}:${line.id}`,
          {
            // Sécurité par défaut : on conserve un tarif déjà existant.
            // Les nouvelles fiches à 0 € prennent automatiquement le calcul fournisseur.
            mode: line.currentSellingPriceHT > 0 ? "current" : "calculated",
            manualPrice: "",
          } satisfies Decision,
        ]),
      ),
    );
  }

  async function action(kind: "preview" | "save_rule") {
    if (!selectedId) return;
    const rule = currentRule();
    if (!rule) return;

    setWorking(kind === "save_rule" ? "save" : "preview");
    setMessage("");

    try {
      const response = await fetch("/api/admin/suppliers/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: kind, supplierId: selectedId, rule }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Opération impossible.");

      if (payload.preview) {
        const nextPreview = payload.preview as Preview;
        setPreview(nextPreview);
        initializeDecisions(nextPreview);
      }

      if (kind === "save_rule") {
        setMessage(payload.message || "Règle enregistrée.");
        await load();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Opération impossible.");
    } finally {
      setWorking(null);
    }
  }

  function updateDecision(line: PricingLine, patch: Partial<Decision>) {
    const key = `${line.targetType}:${line.id}`;
    setDecisions((current) => ({
      ...current,
      [key]: {
        ...(current[key] || {
          mode: line.currentSellingPriceHT > 0 ? "current" : "calculated",
          manualPrice: "",
        }),
        ...patch,
      },
    }));
  }

  function setAll(mode: Exclude<DecisionMode, "manual">) {
    if (!preview) return;
    setDecisions((current) =>
      Object.fromEntries(
        preview.lines.map((line) => {
          const key = `${line.targetType}:${line.id}`;
          const safeMode =
            mode === "calculated" && needsPurchasePriceReview(line)
              ? "current"
              : mode;
          return [
            key,
            {
              ...(current[key] || { mode: safeMode, manualPrice: "" }),
              mode: safeMode,
            } satisfies Decision,
          ];
        }),
      ),
    );
  }

  async function applyCalculatedArbitrage() {
    if (!selectedId || !preview) return;
    const rule = currentRule();
    if (!rule) return;

    if (preview.blockingMissingPurchasePrice > 0) {
      setMessage(`${preview.blockingMissingPurchasePrice} anomalie(s) tarifaire(s) doivent être réglées avant application.`);
      return;
    }

    const calculatedDecisions = preview.lines.map((line) => ({
      targetType: line.targetType,
      id: line.id,
      mode: needsPurchasePriceReview(line) ? ("current" as const) : ("calculated" as const),
      manualPriceHT: null,
    }));

    const calculatedCount = calculatedDecisions.filter((decision) => decision.mode === "calculated").length;
    const confirmation = window.prompt(
      `Application définitive de ${calculatedCount} prix calculés pour ${preview.supplier.name}.\n` +
      `Les ${preview.validNoPriceCount} lignes sans tarif légitime restent inchangées.\n\n` +
      `Tapez exactement APPLIQUER ${calculatedCount} pour confirmer.`,
    );
    if (confirmation !== `APPLIQUER ${calculatedCount}`) return;

    setWorking("apply");
    setMessage("");

    try {
      const response = await fetch("/api/admin/suppliers/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply_arbitrage",
          supplierId: selectedId,
          rule,
          decisions: calculatedDecisions,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Application impossible.");

      setMessage(payload.message || `${calculatedCount} prix calculés appliqués.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Application impossible.");
    } finally {
      setWorking(null);
    }
  }

  async function applyArbitrage() {
    if (!selectedId || !preview) return;
    const rule = currentRule();
    if (!rule) return;

    const payloadDecisions = preview.lines.map((line) => {
      const key = `${line.targetType}:${line.id}`;
      const decision = decisions[key] || {
        mode: line.currentSellingPriceHT > 0 ? "current" : "calculated",
        manualPrice: "",
      };
      const manual = Number(decision.manualPrice.replace(",", "."));

      return {
        targetType: line.targetType,
        id: line.id,
        mode: decision.mode,
        manualPriceHT:
          decision.mode === "manual" && Number.isFinite(manual) && manual > 0
            ? manual
            : null,
      };
    });

    const invalidManual = payloadDecisions.some(
      (decision) => decision.mode === "manual" && decision.manualPriceHT === null,
    );
    if (invalidManual) {
      setMessage("Renseignez un prix manuel valide sur chaque ligne marquée « Manuel ».");
      return;
    }

    setWorking("apply");
    setMessage("");

    try {
      const response = await fetch("/api/admin/suppliers/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply_arbitrage",
          supplierId: selectedId,
          rule,
          decisions: payloadDecisions,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Application impossible.");

      setMessage(payload.message || "Prix retenus appliqués.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Application impossible.");
    } finally {
      setWorking(null);
    }
  }


  async function backfillStockmanPrices() {
    if (!selectedId || !selected || selected.name.trim().toLocaleLowerCase("fr") !== "stockman") return;
    const rule = currentRule();
    if (!rule) return;

    setWorking("backfill");
    setMessage("");
    setPreview(null);
    setDecisions({});
    setBackfillProgress({ updated: 0, skipped: 0, failed: 0, remaining: null });

    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    let remaining = 0;

    try {
      // Les lots restent petits. V2.11.1 réutilise d’abord les données Stockman
      // déjà synchronisées et ne relit l’intranet que pour les vrais trous.
      for (let batch = 0; batch < 100; batch += 1) {
        const response = await fetch("/api/admin/suppliers/pricing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "backfill_stockman_purchase_prices",
            supplierId: selectedId,
            rule,
            batchSize: 20,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "Rattrapage Stockman impossible.");

        totalUpdated += Number(payload.updated || 0);
        totalSkipped += Number(payload.skipped || 0);
        totalFailed += Number(payload.failed || 0);
        remaining = Number(payload.remaining || 0);
        setBackfillProgress({
          updated: totalUpdated,
          skipped: totalSkipped,
          failed: totalFailed,
          remaining,
        });

        if (Number(payload.processed || 0) === 0 || remaining === 0) break;

        // Les références "Nous consulter" / arrêtées sont maintenant marquées
        // comme non tarifables et ne bloquent plus les lots suivants.
        // On n'interrompt que si le lot n'a ni prix récupéré ni référence métier
        // ignorée : cela indique alors un vrai problème technique.
        if (
          Number(payload.updated || 0) === 0 &&
          Number(payload.skipped || 0) === 0
        ) {
          const firstError = Array.isArray(payload.errors) ? payload.errors[0]?.message : null;
          throw new Error(
            firstError
              ? `Rattrapage interrompu : ${firstError}`
              : "Rattrapage interrompu : aucune référence du lot n’a pu être traitée.",
          );
        }
      }

      setMessage(
        `${totalUpdated} prix d’achat Stockman récupéré(s). ${
          totalSkipped ? `${totalSkipped} référence(s) sans tarif fournisseur ignorée(s). ` : ""
        }${
          remaining > 0 ? `${remaining} restent à traiter.` : "Rattrapage terminé."
        }${totalFailed ? ` ${totalFailed} erreur(s) technique(s).` : ""}`,
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Rattrapage Stockman impossible.");
    } finally {
      setWorking(null);
    }
  }

  const purchasePriceReviewCount = useMemo(
    () => preview?.lines.filter(needsPurchasePriceReview).length ?? 0,
    [preview],
  );

  const arbitrationSummary = useMemo(() => {
    if (!preview) return { current: 0, calculated: 0, manual: 0 };
    return preview.lines.reduce(
      (summary, line) => {
        const decision = decisions[`${line.targetType}:${line.id}`];
        const mode = decision?.mode || (line.currentSellingPriceHT > 0 ? "current" : "calculated");
        summary[mode] += 1;
        return summary;
      },
      { current: 0, calculated: 0, manual: 0 } as Record<DecisionMode, number>,
    );
  }, [decisions, preview]);

  const examplePurchase = 100;
  const parsedMargin = Number(marginRate.replace(",", "."));
  const parsedAdjustment = Number(adjustmentRate.replace(",", "."));
  const adjustedPurchase =
    Number.isFinite(parsedAdjustment)
      ? examplePurchase * (1 + parsedAdjustment / 100)
      : examplePurchase;
  const exampleSale =
    Number.isFinite(parsedMargin) && parsedMargin < 100
      ? adjustedPurchase / (1 - parsedMargin / 100)
      : 0;

  return (
    <section className="overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between md:p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black">Politique de prix fournisseur</h2>
            <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-cyan-800">
              V2.10.15 · Contrôle prix d’achat
            </span>
          </div>
          <p className="mt-2 max-w-5xl text-sm leading-6 text-slate-500">
            {selected
              ? `Calculez les prix de ${selected.name}, puis choisissez référence par référence entre le tarif actuel, le tarif calculé et une exception manuelle.`
              : "Définissez une politique tarifaire puis arbitrez les prix avant application."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-xs font-black disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Actualiser
        </button>
      </div>

      <div className="p-5 md:p-6">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 p-8 text-center text-sm font-bold text-slate-500">
            Chargement des fournisseurs…
          </div>
        ) : (
          <>
            <div className="grid gap-5 xl:grid-cols-[1fr_1fr_1.15fr]">
              <div className="text-xs font-black text-slate-600">
                Fournisseur
                {lockSupplier && selected ? (
                  <div className="mt-2 flex min-h-[46px] items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">{selected.name}</p>
                      <p className="mt-0.5 text-[10px] font-bold text-slate-400">
                        {selected.productCount} produit(s) · contexte du workspace
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-cyan-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-cyan-800">
                      Actif
                    </span>
                  </div>
                ) : (
                  <select
                    value={selectedId}
                    onChange={(event) => setSelectedId(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black outline-none focus:border-[#007f8f]"
                  >
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name} · {supplier.productCount} produit(s)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <label className="text-xs font-black text-slate-600">
                Marge cible sur prix de vente
                <div className="relative mt-2">
                  <Percent size={16} className="absolute left-4 top-3.5 text-slate-400" />
                  <input
                    value={marginRate}
                    onChange={(event) => {
                      setMarginRate(event.target.value);
                      setPreview(null);
                      setDecisions({});
                    }}
                    inputMode="decimal"
                    className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-4 text-sm font-black outline-none focus:border-[#007f8f]"
                  />
                </div>
              </label>

              <label className="text-xs font-black text-slate-600">
                Révision du tarif d’achat fournisseur
                <div className="relative mt-2">
                  <TrendingUp size={16} className="absolute left-4 top-3.5 text-slate-400" />
                  <input
                    value={adjustmentRate}
                    onChange={(event) => {
                      setAdjustmentRate(event.target.value);
                      setPreview(null);
                      setDecisions({});
                    }}
                    inputMode="decimal"
                    className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-4 text-sm font-black outline-none focus:border-[#007f8f]"
                  />
                </div>
              </label>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-slate-950 p-5 text-white">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Exemple achat</p>
                <p className="mt-2 text-2xl font-black">{money(examplePurchase)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Après révision fournisseur</p>
                <p className="mt-2 text-2xl font-black text-slate-950">{money(adjustedPurchase)}</p>
              </div>
              <div className="rounded-2xl bg-cyan-50 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-700">Prix de vente calculé</p>
                <p className="mt-2 text-2xl font-black text-[#005466]">{money(exampleSale)}</p>
                <p className="mt-1 text-[10px] font-bold text-cyan-800">PV = PA ajusté ÷ (1 − marge)</p>
              </div>
            </div>

            {selected?.name.trim().toLocaleLowerCase("fr") === "stockman" ? (
              <div className="mt-5 rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4 md:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#007f8f] shadow-sm">
                      <DatabaseZap size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-950">Récupérer les prix d’achat Stockman</p>
                      <p className="mt-1 max-w-3xl text-xs font-bold leading-5 text-slate-500">
                        Réutilise d’abord les prix Stockman déjà synchronisés dans OYSTE, puis relit l’intranet revendeur uniquement pour les vrais prix manquants. Aucun ancien prix Excel n’est utilisé comme prix d’achat.
                      </p>
                      {backfillProgress ? (
                        <p className="mt-2 text-[11px] font-black text-[#007f8f]">
                          {backfillProgress.updated} récupéré(s)
                          {backfillProgress.skipped ? ` · ${backfillProgress.skipped} sans tarif` : ""}
                          {backfillProgress.failed ? ` · ${backfillProgress.failed} échec(s) technique(s)` : ""}
                          {backfillProgress.remaining !== null ? ` · ${backfillProgress.remaining} restant(s)` : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void backfillStockmanPrices()}
                    disabled={working !== null}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#007f8f] px-5 py-3 text-xs font-black text-white disabled:opacity-40"
                  >
                    {working === "backfill" ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    {working === "backfill" ? "Récupération en cours…" : "Récupérer les prix d’achat"}
                  </button>
                </div>
              </div>
            ) : null}

            {message ? (
              <div className="mt-4 rounded-xl border border-cyan-100 bg-cyan-50 p-4 text-sm font-bold text-cyan-900">
                {message}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void action("preview")}
                disabled={!selectedId || working !== null}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-xs font-black disabled:opacity-40"
              >
                {working === "preview" ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
                Prévisualiser
              </button>
              <button
                type="button"
                onClick={() => void action("save_rule")}
                disabled={!selectedId || working !== null}
                className="inline-flex items-center gap-2 rounded-xl border border-[#007f8f]/30 bg-[#007f8f]/5 px-4 py-3 text-xs font-black text-[#005466] disabled:opacity-40"
              >
                {working === "save" ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Enregistrer la marge
              </button>
            </div>

            {selected?.name.trim().toLocaleUpperCase("fr") === "STOCKMAN" ? (
        <section className="rounded-[1.4rem] border border-emerald-200 bg-emerald-50/60 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-black text-slate-950">Finalisation commerciale STOCKMAN · V2.11.2</p>
              <p className="mt-1 max-w-4xl text-xs font-bold leading-5 text-slate-600">
                Applique en masse la règle validée : livraison incluse et départ usine sous 48 h si stock disponible.
                La mention précise qu’il s’agit du délai de départ usine, et non du délai de livraison.
              </p>
              {commercialMessage ? <p className="mt-2 text-xs font-black text-emerald-700">{commercialMessage}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => void finalizeStockmanCommercialRules()}
              disabled={commercialWorking}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-xs font-black text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              {commercialWorking ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              Appliquer livraison incluse + 48 h
            </button>
          </div>
        </section>
      ) : null}

      {preview ? (
              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-4 md:px-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <p className="text-sm font-black text-slate-950">Arbitrage · {preview.supplier.name}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {preview.affectedCount} prix calculable(s) · {preview.validNoPriceCount} sans tarif légitime(s) · {preview.blockingMissingPurchasePrice} anomalie(s) à traiter
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { setAll("current"); setMessage("Tous les prix calculables sont réglés sur « Actuel »."); }}
                        disabled={working !== null}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-600 disabled:opacity-40"
                      >
                        Tout conserver
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAll("calculated"); setMessage(`${preview.affectedCount} prix sont sélectionnés sur « Calculé ». Rien n’est encore écrit en base.`); }}
                        disabled={working !== null}
                        className="rounded-xl border border-[#007f8f]/30 bg-[#007f8f]/10 px-3 py-2 text-[10px] font-black text-[#006d79] disabled:opacity-40"
                      >
                        Sélectionner les {preview.affectedCount} prix calculés
                      </button>
                      <button
                        type="button"
                        onClick={() => void applyCalculatedArbitrage()}
                        disabled={working !== null || preview.affectedCount === 0 || preview.blockingMissingPurchasePrice > 0}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-[10px] font-black text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {working === "apply" ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        Appliquer les {preview.affectedCount} prix calculés
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <SummaryPill label="Prix actuels" value={arbitrationSummary.current} />
                    <SummaryPill label="Prix calculés" value={arbitrationSummary.calculated} />
                    <SummaryPill label="Prix manuels" value={arbitrationSummary.manual} />
                    <SummaryPill label="À vérifier" value={purchasePriceReviewCount} />
                  </div>

                  {preview.missingLines?.length > 0 ? (
                    <div className="mt-3 overflow-hidden rounded-xl border border-orange-200 bg-orange-50/60">
                      <button
                        type="button"
                        onClick={() => setShowMissingPrices((value) => !value)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-xs font-black text-orange-950"
                      >
                        <span>Classification des {preview.missingLines.length} ligne(s) sans prix d’achat</span>
                        <ChevronDown size={16} className={`shrink-0 transition-transform ${showMissingPrices ? "rotate-180" : ""}`} />
                      </button>
                      {showMissingPrices ? (
                        <>
                        <div className="border-t border-orange-200 bg-white px-4 py-3">
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                            <SummaryPill label="Parents avec variantes" value={preview.missingBreakdown.parentWithVariants} />
                            <SummaryPill label="Nous consulter" value={preview.missingBreakdown.supplierConsult} />
                            <SummaryPill label="Liaisons absentes" value={preview.missingBreakdown.catalogLinkMissing} />
                            <SummaryPill label="Anomalies réelles" value={preview.missingBreakdown.realAnomaly} />
                          </div>
                        </div>
                        <div className="max-h-[360px] overflow-auto border-t border-orange-200 bg-white">
                          <table className="w-full min-w-[760px] text-left">
                            <thead className="sticky top-0 bg-orange-50 text-[9px] font-black uppercase tracking-wide text-orange-700">
                              <tr><th className="px-4 py-2">Référence</th><th className="px-4 py-2">Type</th><th className="px-4 py-2">Diagnostic</th><th className="px-4 py-2">Détail</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {preview.missingLines.map((line) => (
                                <tr key={`missing:${line.targetType}:${line.id}`}>
                                  <td className="px-4 py-3"><p className="text-xs font-black text-slate-950">{line.code}</p><p className="mt-1 max-w-[300px] text-[10px] font-bold text-slate-400">{line.name}</p></td>
                                  <td className="px-4 py-3 text-[10px] font-black uppercase text-slate-500">{line.targetType === "variant" ? "Variante" : "Produit"}</td>
                                  <td className={`px-4 py-3 text-xs font-black ${line.blocking ? "text-orange-800" : "text-emerald-700"}`}>{line.reason}</td>
                                  <td className="px-4 py-3 text-[10px] font-bold text-slate-500">{line.detail || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  {purchasePriceReviewCount > 0 ? (
                    <div className="mt-3 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold leading-5 text-rose-900">
                      <TriangleAlert size={17} className="mt-0.5 shrink-0" />
                      <p>
                        {purchasePriceReviewCount} prix d’achat semblent incohérents avec les anciens tarifs (marge actuelle ≥ 70 %). Ils restent sur « Actuel » même avec « Tout prendre au calcul » jusqu’à vérification.
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="max-h-[560px] overflow-auto">
                  <table className="w-full min-w-[1180px] text-left">
                    <thead className="sticky top-0 z-10 bg-white text-[10px] font-black uppercase tracking-wide text-slate-400 shadow-sm">
                      <tr>
                        <th className="px-4 py-3">Référence</th>
                        <th className="px-4 py-3">Achat HT</th>
                        <th className="px-4 py-3">Vente actuelle</th>
                        <th className="px-4 py-3">Marge actuelle</th>
                        <th className="px-4 py-3">Vente calculée</th>
                        <th className="px-4 py-3">Prix retenu</th>
                        <th className="px-4 py-3">Choix</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {preview.lines.map((line) => {
                        const key = `${line.targetType}:${line.id}`;
                        const decision = decisions[key] || {
                          mode: line.currentSellingPriceHT > 0 ? "current" : "calculated",
                          manualPrice: "",
                        };
                        const retained = retainedPrice(line, decision);
                        const purchasePriceNeedsReview = needsPurchasePriceReview(line);

                        return (
                          <tr
                            key={key}
                            className={`align-top ${purchasePriceNeedsReview ? "bg-rose-50/40" : ""}`}
                          >
                            <td className="px-4 py-4">
                              <p className="text-xs font-black text-slate-950">{line.code}</p>
                              <p className="mt-1 max-w-[300px] text-[10px] font-bold leading-4 text-slate-400">{line.name}</p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black uppercase text-slate-500">
                                  {line.targetType === "variant" ? "Variante" : "Produit"}
                                </span>
                                {purchasePriceNeedsReview ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-[9px] font-black uppercase text-rose-700">
                                    <TriangleAlert size={10} />
                                    PA à vérifier
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-xs font-black text-slate-950">{money(line.purchasePriceHT)}</td>
                            <td className="px-4 py-4 text-xs font-bold text-slate-600">{money(line.currentSellingPriceHT)}</td>
                            <td className="px-4 py-4">
                              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                                line.currentMarginRate !== null && line.currentMarginRate >= Number(marginRate.replace(",", "."))
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-amber-50 text-amber-700"
                              }`}>
                                {marginLabel(line.currentMarginRate)}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-xs font-black text-[#007f8f]">{money(line.proposedSellingPriceHT)}</td>
                            <td className="px-4 py-4">
                              <p className="text-sm font-black text-slate-950">{money(retained)}</p>
                              {decision.mode === "manual" ? (
                                <input
                                  value={decision.manualPrice}
                                  onChange={(event) => updateDecision(line, { manualPrice: event.target.value })}
                                  inputMode="decimal"
                                  placeholder="Prix HT"
                                  className="mt-2 w-28 rounded-lg border border-slate-200 px-3 py-2 text-xs font-black outline-none focus:border-[#007f8f]"
                                />
                              ) : null}
                            </td>
                            <td className="px-4 py-4">
                              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                                <ChoiceButton
                                  active={decision.mode === "current"}
                                  onClick={() => updateDecision(line, { mode: "current" })}
                                >
                                  Actuel
                                </ChoiceButton>
                                <ChoiceButton
                                  active={decision.mode === "calculated"}
                                  disabled={purchasePriceNeedsReview}
                                  title={purchasePriceNeedsReview ? "Prix d’achat à vérifier avant d’utiliser le calcul automatique." : undefined}
                                  onClick={() => updateDecision(line, { mode: "calculated" })}
                                >
                                  Calculé
                                </ChoiceButton>
                                <ChoiceButton
                                  active={decision.mode === "manual"}
                                  onClick={() => updateDecision(line, { mode: "manual" })}
                                >
                                  Manuel
                                </ChoiceButton>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-4 border-t border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between md:p-5">
                  <div className="flex items-start gap-3 text-xs font-bold leading-5 text-slate-500">
                    <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#007f8f]" />
                    <p>
                      Rien n’est écrit tant que vous ne validez pas. Les fiches STOCKMAN à 0 € sont déjà présélectionnées sur « Calculé ». Vous pouvez appliquer directement les prix depuis le bouton vert en haut ou utiliser cet arbitrage ligne par ligne.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void applyArbitrage()}
                    disabled={working !== null || preview.lines.length === 0}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-xs font-black text-white disabled:opacity-40"
                  >
                    {working === "apply" ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    Appliquer les prix retenus
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 text-xs font-bold leading-5 text-orange-900">
              <CircleDollarSign size={17} className="mt-0.5 shrink-0" />
              <p>
                La marge fournisseur reste votre règle de référence. L’arbitrage permet seulement de conserver un ancien prix ou de créer une exception manuelle lorsqu’un produit le justifie.
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function ChoiceButton({
  active,
  disabled = false,
  title,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-lg px-2.5 py-2 text-[10px] font-black transition disabled:cursor-not-allowed disabled:opacity-35 ${
        active
          ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200"
          : "text-slate-400 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}
