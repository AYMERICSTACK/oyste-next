"use client";

import { Check, ChevronDown, Sparkles } from "lucide-react";
import type { AnswerValue, ConfiguratorQuestion } from "@/lib/configurator/types";

type Props = {
  questions: ConfiguratorQuestion[];
  answers: Record<string, AnswerValue>;
  stepIndex: number;
  progress: number;
  onStepSelect: (index: number) => void;
  onOpenAll: () => void;
};

function isAnswered(value: AnswerValue) {
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

function getFamily(question: ConfiguratorQuestion) {
  const id = question.id;
  if (["potenceType", "capacity", "reach", "fixing", "wallSupport", "postFixing", "postWidth", "underBeamHeight"].includes(id)) return "Structure";
  if (["mechanicalOptions", "electricalOptions", "outsideOptions"].includes(id)) return "Équipements";
  if (id === "environment") return "Usage";
  if (id === "calculationNote") return "Documents";
  return "Levage";
}

export default function ConfiguratorTopProgress({
  questions,
  answers,
  stepIndex,
  progress,
  onStepSelect,
  onOpenAll,
}: Props) {
  const current = questions[stepIndex];
  const currentFamily = getFamily(current);

  return (
    <header className="shrink-0 border-b border-slate-200 bg-white">
      <div className="flex min-h-[88px] items-center gap-5 px-4 py-3 lg:px-6">
        <div className="hidden min-w-[180px] shrink-0 xl:block">
          <div className="flex items-center gap-2 text-orange-600">
            <Sparkles size={16} />
            <span className="text-[10px] font-black uppercase tracking-[0.22em]">Configurateur OYSTE</span>
          </div>
          <p className="mt-1 text-lg font-black leading-tight text-slate-950">Construisez votre solution</p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">
                Étape {stepIndex + 1} sur {questions.length} · {currentFamily}
              </p>
              <h1 className="mt-0.5 truncate text-xl font-black text-slate-950">{current.eyebrow}</h1>
            </div>
            <button
              type="button"
              onClick={onOpenAll}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:border-slate-400"
            >
              Voir les étapes <ChevronDown size={16} />
            </button>
          </div>

          <div className="mt-3 hidden items-center gap-1.5 lg:flex">
            {questions.map((question, index) => {
              const answered = isAnswered(answers[question.id]);
              const active = index === stepIndex;
              const accessible = index <= stepIndex || answered;
              return (
                <button
                  key={question.id}
                  type="button"
                  disabled={!accessible}
                  onClick={() => accessible && onStepSelect(index)}
                  title={question.title}
                  className={`group flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${
                    active
                      ? "border-orange-300 bg-orange-50"
                      : answered
                        ? "border-[#007f8f]/15 bg-[#007f8f]/5"
                        : "border-slate-100 bg-slate-50 text-slate-400"
                  } disabled:cursor-not-allowed`}
                >
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${active ? "bg-orange-600 text-white" : answered ? "bg-[#007f8f] text-white" : "bg-white text-slate-400"}`}>
                    {answered && !active ? <Check size={13} /> : index + 1}
                  </span>
                  <span className="min-w-0 truncate text-[10px] font-black uppercase tracking-[0.08em]">{question.eyebrow}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-3 lg:hidden">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-orange-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs font-black text-slate-700">{progress}%</span>
          </div>
        </div>
      </div>
    </header>
  );
}
