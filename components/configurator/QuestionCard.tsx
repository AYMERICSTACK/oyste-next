import {
  ArrowLeft,
  ArrowRight,
  CheckSquare2,
  Lightbulb,
  Loader2,
  Square,
} from "lucide-react";
import type {
  AnswerValue,
  ConfiguratorQuestion,
} from "@/lib/configurator/types";
import ChoiceCard from "./ChoiceCard";

function isChoiceSelected(selectedChoice: AnswerValue, choiceId: string) {
  if (Array.isArray(selectedChoice)) return selectedChoice.includes(choiceId);
  return selectedChoice === choiceId;
}

function hasSelection(step: ConfiguratorQuestion, selectedChoice: AnswerValue) {
  if (Array.isArray(selectedChoice)) return selectedChoice.length > 0;
  return Boolean(selectedChoice) || !step.required;
}

function getCustomerHelp(step: ConfiguratorQuestion) {
  const helpers: Record<string, string> = {
    potenceType:
      "Le type de potence détermine la forme de la structure et la façon dont elle sera installée. Le configurateur adapte ensuite les choix disponibles.",
    capacity:
      "Choisissez la charge maximale que vous souhaitez lever. Le palan sera automatiquement dimensionné avec la même capacité.",
    reach:
      "La portée correspond au rayon de travail utile : plus elle est grande, plus la zone couverte autour de la colonne est importante.",
    fixing:
      "La fixation dépend du support disponible sur site. Le kit adapté est ajouté à la configuration selon votre choix.",
    wallSupport:
      "Choisissez le support réel de votre installation. Si la potence est fixée sur un poteau, les étapes suivantes permettront de sélectionner le bon kit.",
    postFixing:
      "La fixation à clamer serre le poteau. La fixation à ceinturer l'entoure pour répartir l'effort autour du support.",
    postWidth:
      "Indiquez la largeur maximale de votre poteau. Le configurateur sélectionne ensuite automatiquement le kit compatible.",
    underBeamHeight:
      "La hauteur sous fer correspond à la distance entre le sol et la poutre de roulement de la potence.",
    mechanicalOptions:
      "Ces options améliorent le confort, la sécurité ou la durabilité de votre installation. Elles sont facultatives.",
    electricalOptions:
      "Ajoutez cette option si vous souhaitez sécuriser ou faciliter l’alimentation électrique de votre installation.",
    environment:
      "Un usage extérieur nécessite des protections adaptées contre les intempéries et l’exposition prolongée.",
    outsideOptions:
      "Sélectionnez uniquement les protections utiles selon l’exposition réelle de votre installation.",
    calculationNote:
      "Le note de calcul ajoute un document technique complémentaire à votre commande.",
    hoist:
      "Le palan est l’équipement qui permet de lever la charge sur la potence. Vous pouvez configurer la potence seule ou une solution complète.",
    hoistType:
      "La capacité du palan suit automatiquement la charge choisie au début du parcours.",
    hoistTrolleyMovement:
      "Le déplacement par poussée se fait à la main. Le déplacement motorisé apporte plus de confort pour les usages fréquents.",
    liftingHeight:
      "La hauteur de levage correspond à la course verticale dont vous avez besoin pour monter et descendre la charge.",
    hoistCommand:
      "La boîte à boutons est une commande filaire. La radiocommande permet de piloter le palan à distance.",
  };

  return helpers[step.id];
}

export default function QuestionCard({
  step,
  stepIndex,
  totalSteps,
  selectedChoice,
  onSelect,
  onNext,
  onPrevious,
  isCompleting = false,
  hideNavigation = false,
}: {
  step: ConfiguratorQuestion;
  stepIndex: number;
  totalSteps: number;
  selectedChoice?: AnswerValue;
  onSelect: (choiceId: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  isCompleting?: boolean;
  hideNavigation?: boolean;
}) {
  const Icon = step.icon;
  const canGoNext = hasSelection(step, selectedChoice);
  const isLastStep = stepIndex === totalSteps - 1;
  const helpText = getCustomerHelp(step);

  return (
    <div className="rounded-[1.35rem] border border-slate-200 bg-white p-3.5 shadow-[0_12px_34px_rgba(15,23,42,0.07)]">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#007f8f]/10 text-[#005466]">
          <Icon size={21} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-600">
            Étape {stepIndex + 1} / {totalSteps} · {step.eyebrow}
          </p>
          <h2 className="mt-0.5 max-w-3xl text-lg font-black tracking-tight text-slate-950">
            {step.title}
          </h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-5 text-slate-600">
            {step.description}
          </p>
        </div>
      </div>

      {helpText && (
        <div className="mt-2.5 flex items-start gap-2.5 rounded-xl border border-[#007f8f]/20 bg-[#007f8f]/5 px-3 py-2 text-[12px] leading-5 text-[#005466]">
          <Lightbulb className="mt-0.5 shrink-0" size={16} />
          <div>
            <p className="font-black text-slate-950">Bon à savoir</p>
            <p className="mt-0.5 font-semibold">{helpText}</p>
          </div>
        </div>
      )}

      {step.multiple && (
        <div className="mt-2.5 flex items-center gap-2.5 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-[12px] font-bold text-slate-700">
          {Array.isArray(selectedChoice) && selectedChoice.length > 0 ? (
            <CheckSquare2 size={18} className="text-orange-600" />
          ) : (
            <Square size={18} className="text-orange-600" />
          )}
          Plusieurs options peuvent être sélectionnées. Vous pouvez aussi
          continuer sans option.
        </div>
      )}

      {step.id === "underBeamHeight" ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <label
            htmlFor="under-beam-height"
            className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500"
          >
            Hauteur sous fer disponible
          </label>
          <select
            id="under-beam-height"
            value={typeof selectedChoice === "string" ? selectedChoice : ""}
            onChange={(event) => onSelect(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-black text-slate-950 outline-none transition focus:border-[#007f8f] focus:ring-2 focus:ring-[#007f8f]/15"
          >
            <option value="" disabled>
              Choisissez une hauteur
            </option>
            {step.choices.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.label}
              </option>
            ))}
          </select>
          {typeof selectedChoice === "string" ? (
            <p className="mt-2 text-[12px] font-semibold leading-5 text-slate-600">
              {
                step.choices.find(
                  (choice) => choice.id === selectedChoice,
                )?.description
              }
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-2">
          {step.choices.map((choice) => (
            <ChoiceCard
              key={choice.id}
              choice={choice}
              selected={isChoiceSelected(selectedChoice, choice.id)}
              onSelect={() => onSelect(choice.id)}
            />
          ))}
        </div>
      )}

      {isCompleting && (
        <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-start gap-4">
            <Loader2 className="mt-1 animate-spin text-orange-600" size={22} />
            <div>
              <p className="font-black text-slate-950">
                Préparation de votre solution...
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Nous regroupons votre structure, votre palan, vos options et le
                prix final.
              </p>
            </div>
          </div>
        </div>
      )}

      {!hideNavigation && <div className="sticky bottom-0 z-10 mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-white/95 pt-3 backdrop-blur">
        <button
          type="button"
          onClick={onPrevious}
          disabled={stepIndex === 0 || isCompleting}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-black uppercase text-slate-600 transition hover:border-slate-400 disabled:pointer-events-none disabled:opacity-40"
        >
          <ArrowLeft size={18} /> Retour
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={!canGoNext || isCompleting}
          className="inline-flex items-center gap-3 rounded-xl bg-slate-950 px-5 py-2.5 text-xs font-black uppercase text-white transition hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-40"
        >
          {isCompleting ? (
            <>
              Préparation <Loader2 className="animate-spin" size={18} />
            </>
          ) : (
            <>
              {isLastStep
                ? "Voir ma solution"
                : step.multiple
                  ? "Continuer"
                  : "Continuer"}
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </div>}
    </div>
  );
}
