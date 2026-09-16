"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  ShoppingCart,
} from "lucide-react";
import { buildConfiguration } from "@/lib/configurator/engine";
import { formatPrice } from "@/lib/configurator/pricing";
import type { Answers } from "@/lib/configurator/types";
import Configurator3DViewer from "./Configurator3DViewer";
import QuestionCard from "./QuestionCard";
import ConfiguratorTopProgress from "./ConfiguratorTopProgress";
import ConfiguratorStepsDrawer from "./ConfiguratorStepsDrawer";
import ConfiguratorVisualFallback from "./ConfiguratorVisualFallback";
import { getConfiguratorFamilyExperience } from "@/lib/configurator/model-registry";
import type { ConfiguratorModelFamily } from "@/lib/configurator/model-types";

const REVEAL_STEPS = [
  "Analyse de votre besoin",
  "Identification de la structure adaptée",
  "Sélection des équipements",
  "Configuration du palan",
  "Vérification des options",
  "Calcul du prix de votre solution",
  "Génération de votre solution",
];

function SolutionReveal({ active }: { active: boolean }) {
  const [visibleStep, setVisibleStep] = useState(0);

  useEffect(() => {
    if (!active) {
      setVisibleStep(0);
      return;
    }
    const timers = REVEAL_STEPS.map((_, index) =>
      window.setTimeout(() => setVisibleStep(index + 1), 330 * (index + 1)),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [active]);

  if (!active) return null;
  const complete = visibleStep >= REVEAL_STEPS.length;
  const progress = Math.min(100, Math.round((visibleStep / REVEAL_STEPS.length) * 100));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/95 px-4 backdrop-blur-md">
      <div className="w-full max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-7 text-center shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
          {complete ? <CheckCircle2 size={34} /> : <Loader2 size={34} className="animate-spin" />}
        </div>
        <p className="mt-5 text-[11px] font-black uppercase tracking-[0.24em] text-orange-600">
          Configuration de votre solution
        </p>
        <h2 className="mt-2 text-3xl font-black text-slate-950 md:text-4xl">
          {complete ? "Votre solution est prête" : "Analyse de votre besoin..."}
        </h2>
        <div className="mt-7 overflow-hidden rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-orange-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}

export default function ConfiguratorExperience() {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [selectedAccessoryIds, setSelectedAccessoryIds] = useState<string[]>([]);
  const [isCompleting, setIsCompleting] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  const questionRef = useRef<HTMLDivElement | null>(null);

  const configuration = useMemo(
    () => buildConfiguration({ answers, stepIndex, selectedAccessoryIds }),
    [answers, stepIndex, selectedAccessoryIds],
  );

  const currentStep = configuration.currentQuestion;
  const selectedChoice = answers[currentStep.id];
  const isLastStep = stepIndex >= configuration.questions.length - 1;
  const selectedFamily = typeof answers.potenceType === "string"
    ? (answers.potenceType as ConfiguratorModelFamily)
    : undefined;
  const familyExperience = getConfiguratorFamilyExperience(selectedFamily);
  const hasInteractive3D = familyExperience?.threeDAvailable === true;

  useEffect(() => {
    questionRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [stepIndex]);

  function cleanFutureAnswers(nextAnswers: Answers, questionId: string) {
    const order = configuration.questions.map((question) => question.id);
    const index = order.indexOf(questionId);
    order.slice(index + 1).forEach((id) => delete nextAnswers[id]);
    return nextAnswers;
  }

  function handleSelect(choiceId: string) {
    const currentAnswer = answers[currentStep.id];
    let nextAnswers: Answers;

    if (currentStep.multiple) {
      const values = Array.isArray(currentAnswer) ? currentAnswer : [];
      const nextValues = values.includes(choiceId)
        ? values.filter((id) => id !== choiceId)
        : [...values, choiceId];
      nextAnswers = cleanFutureAnswers({ ...answers, [currentStep.id]: nextValues }, currentStep.id);
    } else {
      nextAnswers = cleanFutureAnswers({ ...answers, [currentStep.id]: choiceId }, currentStep.id);
    }

    setAnswers(nextAnswers);
    setSelectedAccessoryIds([]);
    setIsCompleting(false);

    if (!currentStep.multiple) {
      window.setTimeout(() => {
        if (!isLastStep) setStepIndex((current) => Math.min(current + 1, configuration.questions.length - 1));
      }, 180);
    }
  }

  function revealSummary() {
    setIsCompleting(true);
    try {
      window.sessionStorage.setItem(
        "oyste-configurator-result",
        JSON.stringify({ answers, selectedAccessoryIds, savedAt: new Date().toISOString() }),
      );
    } catch {}
    window.setTimeout(() => { window.location.href = "/configurateur/resultat"; }, 2850);
  }

  function handleNext() {
    if (isLastStep) return revealSummary();
    setStepIndex((current) => Math.min(current + 1, configuration.questions.length - 1));
  }

  function handlePrevious() {
    setStepIndex((current) => Math.max(current - 1, 0));
    setIsCompleting(false);
  }

  const compactSummary = configuration.summaryLines.slice(0, 4);

  return (
    <>
      <SolutionReveal active={isCompleting} />
      <ConfiguratorStepsDrawer
        open={stepsOpen}
        questions={configuration.questions}
        answers={answers}
        stepIndex={stepIndex}
        onClose={() => setStepsOpen(false)}
        onSelect={setStepIndex}
      />

      <main className="flex h-[calc(100dvh-84px)] min-h-[700px] flex-col overflow-hidden bg-[#eef3f6]">
        <ConfiguratorTopProgress
          questions={configuration.questions}
          answers={answers}
          stepIndex={stepIndex}
          progress={configuration.progress}
          onStepSelect={setStepIndex}
          onOpenAll={() => setStepsOpen(true)}
        />

        <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="relative min-h-[440px] overflow-hidden bg-slate-950 xl:min-h-0">
            {hasInteractive3D ? (
              <Configurator3DViewer configuration={configuration} immersive />
            ) : familyExperience ? (
              <ConfiguratorVisualFallback
                configuration={configuration}
                experience={familyExperience}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_50%_35%,#173042_0%,#08131f_52%,#020617_100%)] px-6">
                <div className="max-w-lg rounded-[2rem] border border-white/15 bg-slate-950/78 p-7 text-center text-white shadow-2xl backdrop-blur-xl">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-orange-400">Première étape</p>
                  <h2 className="mt-2 text-3xl font-black">Choisissez votre famille de potence</h2>
                  <p className="mt-3 text-sm leading-6 text-white/65">La PFI bénéficie déjà de la visualisation 3D temps réel. Les autres familles restent entièrement configurables pendant l’intégration progressive de leurs modèles 3D.</p>
                </div>
              </div>
            )}

            {hasInteractive3D ? (
              <div className="pointer-events-none absolute left-5 top-5 z-20 hidden md:block">
                <div className="rounded-2xl border border-white/10 bg-slate-950/72 px-4 py-3 text-white shadow-xl backdrop-blur-xl">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300">Visualisation 3D</p>
                  <p className="mt-1 text-sm font-black">{familyExperience?.label ?? configuration.businessFamilyLabel}</p>
                </div>
              </div>
            ) : null}
          </section>

          <aside className="flex min-h-0 flex-col border-l border-slate-200 bg-[#f6f8fa]">
            <div ref={questionRef} className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-5">
              <QuestionCard
                step={currentStep}
                stepIndex={stepIndex}
                totalSteps={configuration.questions.length}
                selectedChoice={selectedChoice}
                onSelect={handleSelect}
                onNext={handleNext}
                onPrevious={handlePrevious}
                isCompleting={isCompleting}
                hideNavigation
              />

              {configuration.warnings.map((warning) => (
                <div key={warning.id} className="mt-3 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                  <p className="font-black text-slate-950">{warning.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{warning.message}</p>
                </div>
              ))}

            </div>
          </aside>
        </div>

        <footer className="z-30 shrink-0 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] lg:px-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <p className="shrink-0 text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">Votre configuration</p>
                <button type="button" onClick={() => setStepsOpen(true)} className="text-[11px] font-black text-[#006d79] underline decoration-[#006d79]/30 underline-offset-4">Voir le détail</button>
              </div>
              <div className="mt-1 flex min-w-0 flex-wrap gap-x-4 gap-y-1">
                {compactSummary.length > 0 ? compactSummary.map((line) => (
                  <span key={line.id} className="text-sm font-bold text-slate-700"><strong className="text-slate-950">{line.label} :</strong> {line.value}</span>
                )) : <span className="text-sm text-slate-500">Commencez par choisir votre type de potence.</span>}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 xl:justify-end">
              <div className="min-w-[155px] text-left xl:text-right">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Total HT estimatif</p>
                <p className="mt-0.5 text-2xl font-black text-slate-950">{configuration.priceBreakdown.totalHt > 0 ? formatPrice(configuration.priceBreakdown.totalHt) : "—"}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={stepIndex === 0 || isCompleting}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase text-slate-700 transition hover:border-slate-400 disabled:pointer-events-none disabled:opacity-40"
                >
                  <ArrowLeft size={18} /> <span className="hidden sm:inline">Retour</span>
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={(!currentStep.multiple && !selectedChoice) || isCompleting}
                  className="inline-flex items-center gap-3 rounded-xl bg-slate-950 px-5 py-3 text-xs font-black uppercase text-white transition hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-40"
                >
                  {isLastStep ? "Voir ma solution" : "Continuer"}
                  {isLastStep ? <ShoppingCart size={18} /> : <ArrowRight size={18} />}
                </button>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
