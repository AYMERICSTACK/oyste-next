"use client";

import { Check, Circle, X } from "lucide-react";
import type { AnswerValue, ConfiguratorQuestion } from "@/lib/configurator/types";

type Props = {
  open: boolean;
  questions: ConfiguratorQuestion[];
  answers: Record<string, AnswerValue>;
  stepIndex: number;
  onClose: () => void;
  onSelect: (index: number) => void;
};

function isAnswered(value: AnswerValue) {
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

function familyFor(id: string) {
  if (["potenceType", "capacity", "reach", "fixing", "wallSupport", "postFixing", "postWidth", "underBeamHeight"].includes(id)) return "Structure";
  if (["mechanicalOptions", "electricalOptions", "outsideOptions"].includes(id)) return "Équipements";
  if (id === "environment") return "Usage";
  if (id === "calculationNote") return "Documents";
  return "Levage";
}

export default function ConfiguratorStepsDrawer({ open, questions, answers, stepIndex, onClose, onSelect }: Props) {
  if (!open) return null;
  const families = Array.from(new Set(questions.map((question) => familyFor(question.id))));

  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-slate-950/55 backdrop-blur-sm" onMouseDown={onClose}>
      <aside className="h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-600">Votre parcours</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Toutes les étapes</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 p-2.5 text-slate-600 transition hover:bg-slate-50" aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6 p-5">
          {families.map((family) => (
            <section key={family}>
              <h3 className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{family}</h3>
              <div className="space-y-2">
                {questions.map((question, index) => {
                  if (familyFor(question.id) !== family) return null;
                  const answered = isAnswered(answers[question.id]);
                  const active = index === stepIndex;
                  const accessible = index <= stepIndex || answered;
                  const selectedIds: string[] = Array.isArray(answers[question.id])
                    ? (answers[question.id] as string[])
                    : typeof answers[question.id] === "string"
                      ? [answers[question.id] as string]
                      : [];
                  const answerLabel = question.choices.filter((choice) => selectedIds.includes(choice.id)).map((choice) => choice.label).join(", ");
                  return (
                    <button
                      key={question.id}
                      type="button"
                      disabled={!accessible}
                      onClick={() => { if (accessible) { onSelect(index); onClose(); } }}
                      className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition ${active ? "border-orange-300 bg-orange-50" : answered ? "border-[#007f8f]/20 bg-[#007f8f]/5" : "border-slate-200 bg-white"} disabled:opacity-50`}
                    >
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${active ? "bg-orange-600 text-white" : answered ? "bg-[#007f8f] text-white" : "bg-slate-100 text-slate-400"}`}>
                        {answered && !active ? <Check size={16} /> : index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{question.eyebrow}</span>
                        <span className="mt-0.5 block text-sm font-black text-slate-950">{question.title}</span>
                        <span className={`mt-1 block text-xs ${answerLabel ? "font-bold text-[#006d79]" : "text-slate-400"}`}>
                          {answerLabel || (active ? "En cours" : "À définir")}
                        </span>
                      </span>
                      {answered ? <Check size={17} className="mt-1 text-[#007f8f]" /> : <Circle size={16} className="mt-1 text-slate-300" />}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}
