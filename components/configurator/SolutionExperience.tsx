"use client";
import { getWallFixingWeightKg } from "@/lib/shipping/wall-potence-option-weights";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Box,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Download,
  PackageCheck,
  RefreshCw,
} from "lucide-react";
import Container from "@/components/ui/Container";
import { buildConfiguration } from "@/lib/configurator/engine";
import { formatPrice } from "@/lib/configurator/pricing";
import type { Answers, EngineResult, HoistDetail } from "@/lib/configurator/types";
import ConfiguredCartButton from "@/components/cart/ConfiguredCartButton";
import VisualConfigPreview from "./VisualConfigPreview";

type StoredConfiguration = {
  answers?: Answers;
  selectedAccessoryIds?: string[];
};

function readStoredConfiguration(): StoredConfiguration | null {
  try {
    const raw = window.sessionStorage.getItem("oyste-configurator-result");
    if (!raw) return null;
    return JSON.parse(raw) as StoredConfiguration;
  } catch {
    return null;
  }
}

function getAnswerLabel(configuration: EngineResult, questionId: string) {
  const question = configuration.questions.find((item) => item.id === questionId);
  const answer = configuration.answers[questionId];

  if (Array.isArray(answer)) {
    const labels = question?.choices
      .filter((choice) => answer.includes(choice.id))
      .map((choice) => choice.label);

    return labels?.length ? labels.join(", ") : undefined;
  }

  return question?.choices.find((choice) => choice.id === answer)?.label;
}


function parseMetersAnswer(value: unknown) {
  if (typeof value !== "string") return undefined;
  const match = value.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : undefined;
}

function formatMeters(value?: number) {
  if (value === undefined) return undefined;
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} m`;
}

function SolutionSpec({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-950">{value ?? "Non renseigné"}</p>
    </div>
  );
}

function HoistSummary({ hoistDetail }: { hoistDetail?: HoistDetail }) {
  if (!hoistDetail) {
    return (
      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-600">Palan</p>
        <h3 className="mt-2 text-2xl font-black text-slate-950">Aucun palan ajouté</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Votre configuration ne contient pas de palan. Vous pouvez revenir au configurateur si vous souhaitez ajouter un équipement de levage.
        </p>
      </div>
    );
  }

  const items = [
    { label: "Capacité", value: `${hoistDetail.capacityKg} kg` },
    { label: "Déplacement", value: hoistDetail.trolleyMovementLabel?.replace("Chariot ", "") },
    { label: "Hauteur de levage", value: `${hoistDetail.liftingHeightM} m` },
    { label: "Commande", value: hoistDetail.commandLabel },
    { label: "Câble de commande", value: formatMeters(hoistDetail.controlCableLengthM) },
    { label: "Bac à chaîne", value: hoistDetail.chainBucketLabel },
  ].filter((item) => item.value);

  return (
    <div className="rounded-[1.5rem] border border-orange-200 bg-orange-50/70 p-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-700">Palan inclus</p>
          <h3 className="mt-2 text-2xl font-black text-slate-950">{hoistDetail.title}</h3>
          <p className="mt-1 text-sm font-bold text-slate-600">{hoistDetail.subtitle}</p>
        </div>
        <p className="text-2xl font-black text-slate-950">{formatPrice(hoistDetail.totalHt)}</p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div key={`${item.label}-${item.value}`} className="rounded-2xl bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
            <p className="mt-1 text-base font-black text-slate-950">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl bg-white p-4">
        <p className="flex items-center gap-2 text-sm font-black text-slate-950">
          <PackageCheck size={18} className="text-[#007f8f]" /> Inclus dans le palan
        </p>
        <div className="mt-3 grid gap-2 text-sm font-bold text-slate-700 sm:grid-cols-2">
          <span>✓ Chariot adapté à votre choix</span>
          <span>✓ Sécurité et fins de course</span>
          <span>✓ Bac à chaîne adapté</span>
          <span>✓ Préparation et réglages usine</span>
        </div>
      </div>
    </div>
  );
}

function TechnicalDetails({ configuration }: { configuration: EngineResult }) {
  const selectedLines = configuration.summaryLines.filter(
    (line) => line.type !== "answer" && line.priceImpact !== undefined && line.priceImpact > 0,
  );

  return (
    <details className="group rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Votre solution en détail</p>
          <h3 className="mt-1 text-xl font-black text-slate-950">Voir les principaux éléments inclus</h3>
        </div>
        <ChevronDown className="shrink-0 text-slate-500 transition group-open:rotate-180" />
      </summary>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {selectedLines.map((line) => (
          <div key={line.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{line.label}</p>
            <p className="mt-1 text-base font-black text-slate-950">{line.value}</p>
            {line.priceImpact ? (
              <p className="mt-2 text-sm font-black text-orange-600">{formatPrice(line.priceImpact)}</p>
            ) : null}
          </div>
        ))}
      </div>

      <p className="mt-4 text-sm font-bold leading-6 text-slate-500">
        Ce récapitulatif présente les principaux équipements et options inclus dans votre configuration.
      </p>
    </details>
  );
}

function EmptyState() {
  return (
    <section className="min-h-[calc(100dvh-90px)] bg-slate-50 py-12">
      <Container>
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/70">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
            <RefreshCw size={30} />
          </div>
          <h1 className="mt-5 text-3xl font-black text-slate-950">Configuration à relancer</h1>
          <p className="mt-3 text-slate-600">
            Aucune solution finalisée n’a été trouvée dans cette session. Relancez le configurateur pour générer une proposition complète.
          </p>
          <Link
            href="/configurateur"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-orange-600 px-6 py-3 text-sm font-black uppercase text-white transition hover:bg-orange-700"
          >
            Reprendre le configurateur
          </Link>
        </div>
      </Container>
    </section>
  );
}

export default function SolutionExperience() {
  const [stored, setStored] = useState<StoredConfiguration | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setStored(readStoredConfiguration());
    setLoaded(true);
  }, []);

  const configuration = useMemo(() => {
    if (!stored?.answers) return null;

    return buildConfiguration({
      answers: stored.answers,
      stepIndex: 999,
      selectedAccessoryIds: stored.selectedAccessoryIds ?? [],
    });
  }, [stored]);

  if (!loaded) return null;
  if (!configuration) return <EmptyState />;

  const solution = configuration.erpInstallation.match?.ouvrage;
  const potenceType = getAnswerLabel(configuration, "potenceType");
  const capacity = getAnswerLabel(configuration, "capacity");
  const reach = getAnswerLabel(configuration, "reach");
  const fixing = getAnswerLabel(configuration, "fixing");
  const underBeamHeight = getAnswerLabel(configuration, "underBeamHeight");
  const environment = getAnswerLabel(configuration, "environment");
  const capacityKg = Number(configuration.answers.capacity);
  const spanM = parseMetersAnswer(configuration.answers.reach);
  const hsfM = parseMetersAnswer(configuration.answers.underBeamHeight);
  const fixingAnswer = configuration.answers.fixing;
  const selectedFamily =
    typeof configuration.answers.potenceType === "string"
      ? configuration.answers.potenceType.toUpperCase()
      : configuration.selectedVariant?.familyCode;
  const hasUnderBeamHeight = ["PFI", "PFT"].includes(selectedFamily ?? "");
  const pfiShipping = ["PFI", "PFT"].includes(selectedFamily ?? "") && capacityKg && spanM && hsfM && typeof fixingAnswer === "string"
    ? { family: selectedFamily as "PFI" | "PFT", capacityKg, spanM, hsfM, fixing: fixingAnswer === "semelle-cheviller" ? "CHEMICAL" as const : "STANDARD" as const }
    : undefined;
  const wallFixingWeightKg = getWallFixingWeightKg([
    ...configuration.erpInstallation.includedComponents,
    ...configuration.erpInstallation.optionalComponents,
  ]);
  const hoistWeightKg = configuration.hoistDetail?.weightKg ?? 0;
  const wallPotenceShipping = ["PMI", "PMT"].includes(selectedFamily ?? "") && capacityKg && spanM
    ? {
        family: selectedFamily as "PMI" | "PMT",
        capacityKg,
        spanM,
        additionalWeightKg: wallFixingWeightKg + hoistWeightKg,
        weightComplete: configuration.hoistDetail ? configuration.hoistDetail.weightComplete !== false : true,
    }
    : undefined;
  const configuredCartProps = {
    name: solution?.label ?? configuration.selectedVariant?.label ?? "Potence configurée OYSTE",
    code: configuration.selectedVariant?.reference ?? solution?.code,
    priceHT: configuration.priceBreakdown.totalHt,
    editHref: "/configurateur",
    pfiShipping,
    wallPotenceShipping,
    technicalLines: [
      { label: "Type", value: potenceType ?? "Non renseigné" },
      { label: "Charge", value: capacity ?? "Non renseigné" },
      { label: "Portée", value: reach ?? "Non renseigné" },
      ...(hasUnderBeamHeight
        ? [{ label: "Hauteur", value: underBeamHeight ?? "Non renseigné" }]
        : []),
      { label: "Fixation", value: fixing ?? "Non renseigné" },
      { label: "Environnement", value: environment ?? "Non renseigné" },
    ],
  };

  return (
    <section className="bg-slate-50 py-6 pb-32 lg:min-h-[calc(100dvh-90px)] lg:pb-6">
      <Container className="max-w-[1500px]">
        <Link href="/configurateur" className="inline-flex items-center gap-2 text-sm font-black uppercase text-slate-600 transition hover:text-orange-600">
          <ArrowLeft size={17} /> Modifier la configuration
        </Link>

        <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-5">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70 md:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-[11px] font-black uppercase tracking-[0.25em] text-orange-600">Solution prête</p>
                  <h1 className="mt-3 text-4xl font-black leading-tight tracking-tight text-slate-950 md:text-5xl">
                    Votre solution de levage est configurée.
                  </h1>
                  <p className="mt-4 text-base leading-7 text-slate-600">
                    Votre solution est prête. Ajoutez-la à votre panier pour finaliser votre commande ou modifiez votre configuration si nécessaire.
                  </p>
                </div>
                <div className="rounded-2xl bg-[#007f8f]/10 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-[#005466]">
                  <CheckCircle2 className="mr-2 inline" size={18} /> Disponible
                </div>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
              <VisualConfigPreview configuration={configuration} variant="large" />

              <div className="space-y-4">
                <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/60">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-600">Votre structure</p>
                  <h2 className="mt-2 text-2xl font-black leading-tight text-slate-950">
                    {solution?.label ?? configuration.selectedVariant?.label ?? "Installation configurée"}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {hasUnderBeamHeight
                      ? "Structure adaptée au type de potence, à la charge, à la portée, à la hauteur et au mode de fixation que vous avez renseignés."
                      : "Structure adaptée au type de potence, à la charge, à la portée et au mode de fixation que vous avez renseignés."}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
                  <SolutionSpec label="Type" value={potenceType} />
                  <SolutionSpec label="Charge" value={capacity} />
                  <SolutionSpec label="Portée" value={reach} />
                  {hasUnderBeamHeight ? <SolutionSpec label="Hauteur" value={underBeamHeight} /> : null}
                  <SolutionSpec label="Fixation" value={fixing} />
                  <SolutionSpec label="Environnement" value={environment} />
                  <SolutionSpec label="Statut" value="Prête à commander" />
                </div>
              </div>
            </div>

            <HoistSummary hoistDetail={configuration.hoistDetail} />
            <TechnicalDetails configuration={configuration} />
          </div>

          <aside className="xl:sticky xl:top-24 xl:self-start">
            <div className="rounded-[2rem] bg-slate-950 p-5 text-white shadow-2xl shadow-slate-300/80">
              <p className="text-sm font-bold text-slate-400">Prix HT</p>
              <p className="mt-2 text-5xl font-black tracking-tight">{formatPrice(configuration.priceBreakdown.totalHt)}</p>

              <div className="mt-5 space-y-2 rounded-2xl bg-white/5 p-4 text-sm font-bold text-slate-300">
                <div className="flex justify-between gap-4"><span>Structure</span><span>{formatPrice(configuration.priceBreakdown.solutionTotal)}</span></div>
                <div className="flex justify-between gap-4"><span>Palan</span><span>{configuration.priceBreakdown.hoistTotal > 0 ? formatPrice(configuration.priceBreakdown.hoistTotal) : "—"}</span></div>
                <div className="flex justify-between gap-4"><span>Compléments</span><span>{configuration.priceBreakdown.complementsTotal > 0 ? formatPrice(configuration.priceBreakdown.complementsTotal) : "—"}</span></div>
              </div>

              <ConfiguredCartButton {...configuredCartProps} />
              <button type="button" className="mt-3 inline-flex w-full items-center justify-center gap-3 rounded-xl border border-white/15 px-5 py-4 text-sm font-black uppercase text-white transition hover:bg-white/10">
                <Download size={19} /> Télécharger le récapitulatif
              </button>
              <Link href="/configurateur" className="mt-3 inline-flex w-full items-center justify-center gap-3 rounded-xl bg-white px-5 py-4 text-sm font-black uppercase text-slate-950 transition hover:bg-slate-100">
                <ClipboardList size={19} /> Modifier la configuration
              </Link>
            </div>

            <div className="mt-4 rounded-[1.5rem] border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600">
              <p className="flex items-center gap-2 font-black text-slate-950"><Box size={18} /> Commande en ligne</p>
              <p className="mt-2">
                Votre solution est prête à être commandée. Ajoutez-la au panier pour finaliser votre commande en ligne.
              </p>
            </div>
          </aside>
        </div>
      </Container>
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-12px_35px_rgba(15,23,42,0.16)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="shrink-0">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Total HT</p>
            <p className="text-lg font-black text-slate-950">{formatPrice(configuration.priceBreakdown.totalHt)}</p>
          </div>
          <ConfiguredCartButton {...configuredCartProps} className="mt-0 min-h-12 flex-1 px-3 py-3 text-xs" />
        </div>
      </div>
    </section>
  );
}
