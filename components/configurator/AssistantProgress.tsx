import type { ConfiguratorQuestion } from "@/lib/configurator/types";

const PHASES = [
  {
    id: "identify",
    label: "Identification",
    description: "Charge et portée",
    stepIds: ["capacity", "reach"],
  },
  {
    id: "structure",
    label: "Structure",
    description: "Fixation et hauteur",
    stepIds: ["fixing", "underBeamHeight"],
  },
  {
    id: "options",
    label: "Équipements",
    description: "Options et environnement",
    stepIds: ["mechanicalOptions", "electricalOptions", "environment", "outsideOptions", "calculationNote"],
  },
  {
    id: "hoist",
    label: "Palan",
    description: "Levage et commande",
    stepIds: ["hoist", "hoistType", "liftingHeight", "hoistCommand"],
  },
];

function getPhaseIndex(step?: ConfiguratorQuestion) {
  if (!step) return 0;
  const index = PHASES.findIndex((phase) => phase.stepIds.includes(step.id));
  return index >= 0 ? index : 0;
}

export default function AssistantProgress({
  current,
  total,
  step,
}: {
  current: number;
  total: number;
  step?: ConfiguratorQuestion;
}) {
  const percent = Math.round(((current + 1) / total) * 100);
  const activePhaseIndex = getPhaseIndex(step);
  const activePhase = PHASES[activePhaseIndex];

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-600">
            {activePhase.label}
          </p>
          <p className="mt-1 text-sm font-black text-slate-600">
            Étape {current + 1} sur {total} · {activePhase.description}
          </p>
        </div>
        <span className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">
          {percent}%
        </span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-orange-600 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-4">
        {PHASES.map((phase, index) => {
          const isDone = index < activePhaseIndex;
          const isActive = index === activePhaseIndex;

          return (
            <div
              key={phase.id}
              className={`rounded-2xl border px-3 py-3 transition-all duration-300 ${
                isActive
                  ? "border-orange-200 bg-orange-50 shadow-sm"
                  : isDone
                    ? "border-[#007f8f]/20 bg-[#007f8f]/5"
                    : "border-slate-100 bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${
                    isActive
                      ? "bg-orange-600 text-white"
                      : isDone
                        ? "bg-[#007f8f] text-white"
                        : "bg-white text-slate-400"
                  }`}
                >
                  {index + 1}
                </span>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-700">
                  {phase.label}
                </p>
              </div>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                {phase.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
