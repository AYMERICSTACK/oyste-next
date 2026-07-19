import { forwardRef } from "react";
import {
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  PackagePlus,
  ShoppingCart,
} from "lucide-react";
import { formatPrice } from "@/lib/configurator/pricing";
import VisualConfigPreview from "./VisualConfigPreview";
import Configurator3DViewer from "./Configurator3DViewer";
import type { EngineResult, SummaryLine } from "@/lib/configurator/types";

function getAnswerLabel(configuration: EngineResult, questionId: string) {
  const question = configuration.questions.find((item) => item.id === questionId);
  const answer = configuration.answers[questionId];

  if (Array.isArray(answer)) {
    const labels = question?.choices
      .filter((choice) => answer.includes(choice.id))
      .map((choice) => choice.label);

    return labels?.length ? labels.join(", ") : undefined;
  }

  const selected = question?.choices.find((choice) => choice.id === answer);

  return selected?.label;
}

function compactAnswer(value?: string) {
  if (!value) return undefined;
  return value.length > 42 ? `${value.slice(0, 42)}...` : value;
}

function formatQuantity(quantity: number) {
  return Number.isInteger(quantity)
    ? `x${quantity}`
    : `x${quantity.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}`;
}

function formatMeters(value?: number) {
  if (value === undefined) return undefined;
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} m`;
}

function getHoistIncludedItems(hoistDetail: EngineResult["hoistDetail"]) {
  if (!hoistDetail) return [];

  const items = [
    { label: "Capacité", value: `${hoistDetail.capacityKg} kg` },
    { label: "Hauteur de levage", value: `${hoistDetail.liftingHeightM} m` },
  ];

  if (hoistDetail.trolleyMovementLabel) {
    items.push({
      label: "Déplacement",
      value: hoistDetail.trolleyMovementLabel.replace("Chariot ", ""),
    });
  }

  if (hoistDetail.commandLabel) {
    items.push({ label: "Commande", value: hoistDetail.commandLabel });
  }

  if (hoistDetail.controlCableLengthM !== undefined) {
    items.push({
      label: "Câble de commande",
      value: `${hoistDetail.controlCableLengthM.toLocaleString("fr-FR", {
        maximumFractionDigits: 2,
      })} m`,
    });
  }

  if (hoistDetail.chainBucketLabel) {
    items.push({ label: "Bac à chaîne", value: hoistDetail.chainBucketLabel });
  }

  if (hoistDetail.mode === "electric") {
    items.push(
      { label: "Sécurité", value: "Butées et fins de course incluses" },
      { label: "Préparation", value: "Câblage et réglages usine inclus" },
    );
  } else {
    items.push({ label: "Base incluse", value: "3 m de levage" });
  }

  return items;
}

function SummaryBadge({ line }: { line: SummaryLine }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {line.label}
      </p>
      <p className="mt-1 text-sm font-black leading-5 text-slate-950">
        {line.value}
      </p>
      {line.priceImpact !== undefined && line.priceImpact > 0 && (
        <p className="mt-1 text-xs font-black text-orange-600">
          + {formatPrice(line.priceImpact)}
        </p>
      )}
    </div>
  );
}

const SummaryPanel = forwardRef<HTMLElement, { configuration: EngineResult }>(
  function SummaryPanel({ configuration }, ref) {
    const potenceType = getAnswerLabel(configuration, "potenceType");
    const capacity = getAnswerLabel(configuration, "capacity");
    const reach = getAnswerLabel(configuration, "reach");
    const fixing = getAnswerLabel(configuration, "fixing");
    const underBeamHeight = getAnswerLabel(configuration, "underBeamHeight");
    const hoistType = getAnswerLabel(configuration, "hoistType");
    const hoistTrolleyMovement = getAnswerLabel(configuration, "hoistTrolleyMovement");
    const liftingHeight = getAnswerLabel(configuration, "liftingHeight");
    const installationResult = configuration.erpInstallation;
    const installationSummary = configuration.installationSummary;
    const solution = installationResult.match?.ouvrage;
    const mainComponent = installationResult.mainComponent;
    const componentLines = installationSummary.visibleComponents;
    const hiddenComponentsCount = installationSummary.hiddenComponentsCount;
    const priceBreakdown = configuration.priceBreakdown;
    const hoistDetail = configuration.hoistDetail;
    const selectedOptionLines = configuration.summaryLines.filter(
      (line) => line.type !== "product" || line.priceImpact !== undefined,
    );

    const details = [
      { label: "Type", value: potenceType },
      { label: "Charge", value: capacity },
      { label: "Portée", value: reach },
      { label: "Fixation", value: compactAnswer(fixing) },
      { label: "Hauteur", value: underBeamHeight },
      { label: "Palan", value: hoistType },
      { label: "Chariot", value: hoistTrolleyMovement },
      { label: "Levage", value: liftingHeight },
      { label: "Câble commande", value: formatMeters(hoistDetail?.controlCableLengthM) },
      { label: "Bac chaîne", value: hoistDetail?.chainBucketLabel },
    ];

    return (
      <aside
        ref={ref}
        id="configuration-result"
        className="min-h-0 scroll-mt-24 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.10)] xl:h-full xl:overflow-y-auto"
      >
        <div className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 p-4 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-600">
                Configuration en direct
              </p>
              <h2 className="mt-1 text-2xl font-black leading-tight text-slate-950">
                {solution ? "Installation prête" : "À construire"}
              </h2>
            </div>
            <span className="rounded-full bg-[#007f8f]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#005466]">
              {installationSummary.badge}
            </span>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-white shadow-lg">
            <div className="flex items-end justify-between gap-4 p-4">
              <div>
                <p className="text-xs font-bold text-slate-400">Total HT estimatif</p>
                <p className="mt-1 text-3xl font-black tracking-tight">
                  {priceBreakdown.totalHt > 0 ? formatPrice(priceBreakdown.totalHt) : "—"}
                </p>
              </div>
              <div className="text-right text-[11px] font-bold leading-5 text-slate-400">
                <p>Solution : {priceBreakdown.solutionTotal > 0 ? formatPrice(priceBreakdown.solutionTotal) : "—"}</p>
                <p>Palan : {priceBreakdown.hoistTotal > 0 ? formatPrice(priceBreakdown.hoistTotal) : "—"}</p>
                <p>Compléments : {priceBreakdown.complementsTotal > 0 ? formatPrice(priceBreakdown.complementsTotal) : "—"}</p>
              </div>
            </div>

            <button
              type="button"
              disabled={!installationSummary.canAddToCart || priceBreakdown.totalHt === 0}
              className="inline-flex w-full items-center justify-center gap-3 border-t border-white/10 bg-orange-600 px-4 py-3.5 text-sm font-black uppercase tracking-[0.04em] text-white transition hover:bg-orange-700 disabled:pointer-events-none disabled:opacity-40"
            >
              <ShoppingCart size={18} /> Ajouter au panier
            </button>
          </div>
        </div>

        <div className="space-y-4 p-4">
          {configuration.answers.potenceType === "PFI" ? (
            <Configurator3DViewer configuration={configuration} />
          ) : (
            <VisualConfigPreview configuration={configuration} />
          )}

          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#005466]">
              Recommandation
            </p>
            <h3 className="mt-1 text-lg font-black leading-6 text-slate-950">
              {solution?.label ?? configuration.selectedVariant?.label ?? "Installation à préciser"}
            </h3>
            <p className="mt-1 text-sm leading-5 text-slate-600">
              {mainComponent?.label ?? installationSummary.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {details.map((detail) => (
              <div
                key={detail.label}
                className={`rounded-2xl border p-3 ${
                  detail.value
                    ? "border-[#007f8f]/20 bg-[#007f8f]/5"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="flex items-start gap-2">
                  {detail.value ? (
                    <CheckCircle2 className="mt-0.5 shrink-0 text-[#007f8f]" size={16} />
                  ) : (
                    <CircleDashed className="mt-0.5 shrink-0 text-slate-400" size={16} />
                  )}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                      {detail.label}
                    </p>
                    <p className="mt-0.5 text-sm font-black leading-5 text-slate-950">
                      {detail.value ?? "À choisir"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {hoistDetail && (
            <div className="rounded-2xl border border-orange-200 bg-orange-50/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-700">
                    Palan inclus
                  </p>
                  <h3 className="mt-1 text-lg font-black text-slate-950">{hoistDetail.title}</h3>
                  <p className="mt-1 text-sm font-bold text-slate-600">{hoistDetail.subtitle}</p>
                </div>
                <p className="shrink-0 text-right text-lg font-black text-slate-950">
                  {formatPrice(hoistDetail.totalHt)}
                </p>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {getHoistIncludedItems(hoistDetail).map((item) => (
                  <div key={`${item.label}-${item.value}`} className="rounded-xl bg-white px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-sm font-black text-slate-950">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedOptionLines.length > 0 && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-600">
                Choix retenus
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {selectedOptionLines.slice(0, 6).map((line) => (
                  <SummaryBadge key={line.id} line={line} />
                ))}
              </div>
            </div>
          )}

          {configuration.selectedAccessories.length > 0 && (
            <div className="rounded-2xl border border-slate-100 p-3">
              <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-orange-600">
                <PackagePlus size={15} /> Éléments ajoutés
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {configuration.selectedAccessories.map((accessory) => (
                  <span key={accessory.id} className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">
                    {accessory.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          <details className="group rounded-2xl border border-slate-200 bg-white p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Ce qui est inclus
                </p>
                <p className="mt-1 text-sm font-bold text-slate-950">
                  Voir les principaux éléments compris dans votre solution.
                </p>
              </div>
              <ChevronDown className="shrink-0 text-slate-500 transition group-open:rotate-180" size={20} />
            </summary>

            {componentLines.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
                <div className="grid grid-cols-[1fr_54px_100px] bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                  <span>Élément</span>
                  <span className="text-right">Qté</span>
                  <span className="text-right">Prix HT</span>
                </div>

                <div className="divide-y divide-slate-100">
                  {componentLines.map((component) => (
                    <div key={component.id} className="grid grid-cols-[1fr_54px_100px] items-start gap-3 px-3 py-3 text-sm">
                      <div>
                        <p className="font-black leading-5 text-slate-950">{component.label}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {component.quantity > 1 ? `${formatPrice(component.unitPrice)} HT / unité` : `${formatPrice(component.unitPrice)} HT`}
                        </p>
                      </div>
                      <span className="text-right font-black text-slate-700">{formatQuantity(component.quantity)}</span>
                      <span className="text-right font-black text-slate-950">{formatPrice(component.totalPrice)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hoistDetail ? (
              <div className="mt-4 rounded-2xl border border-orange-100 bg-orange-50/60 p-3">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-700">
                  Palan inclus
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {getHoistIncludedItems(hoistDetail).map((item) => (
                    <div key={`${item.label}-${item.value}`} className="rounded-xl bg-white px-3 py-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{item.label}</p>
                      <p className="mt-0.5 text-sm font-black text-slate-950">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {hiddenComponentsCount > 0 && (
              <p className="mt-3 text-xs font-bold text-slate-500">
                D’autres éléments de préparation sont inclus automatiquement dans la solution.
              </p>
            )}
          </details>
        </div>
      </aside>
    );
  },
);

export default SummaryPanel;
