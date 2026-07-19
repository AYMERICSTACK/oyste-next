import {
  BadgeCheck,
  Building2,
  Cable,
  Check,
  CircleDot,
  CloudSun,
  FileText,
  Hammer,
  MoveHorizontal,
  Radio,
  Ruler,
  ShieldCheck,
  Sparkles,
  SquareStack,
  Weight,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ConfiguratorChoice } from "@/lib/configurator/types";

function getChoiceBadge(choice: ConfiguratorChoice) {
  if (choice.recommended) return "Recommandé";

  const familyBadges: Record<string, string> = {
    PFI: "Sur fût",
    PFT: "Sur fût",
    PMI: "Murale",
    PMT: "Murale",
    PMA: "Articulée",
    PMAM: "Motorisée",
  };

  return familyBadges[choice.id] ?? null;
}

function getChoiceIcon(choice: ConfiguratorChoice): LucideIcon {
  const id = choice.id.toLowerCase();
  const label = `${choice.label} ${choice.description}`.toLowerCase();

  if (["pfi", "pft"].includes(id)) return Building2;
  if (["pmi", "pmt", "pma", "pmam"].includes(id)) return SquareStack;
  if (id.includes("capacity") || label.includes("kg") || label.includes("tonne")) return Weight;
  if (id.includes("reach") || label.includes("portée") || label.includes("mètre")) return Ruler;
  if (id.includes("fixing") || label.includes("fixation") || label.includes("clamer") || label.includes("ceinturer")) return Hammer;
  if (id.includes("height") || label.includes("hauteur")) return Ruler;
  if (id.includes("mechanical") || label.includes("ralentisseur") || label.includes("verrouillage")) return Wrench;
  if (id.includes("electrical") || label.includes("interrupteur") || label.includes("électrique")) return Zap;
  if (id.includes("environment") || label.includes("extérieur") || label.includes("peinture") || label.includes("étanchéité")) return CloudSun;
  if (id.includes("document") || id.includes("note") || label.includes("note de calcul")) return FileText;
  if (id.includes("radio") || label.includes("radiocommande")) return Radio;
  if (id.includes("button") || label.includes("boîte à boutons") || label.includes("câble")) return Cable;
  if (id.includes("motor") || label.includes("motorisé")) return MoveHorizontal;
  if (id.includes("security") || label.includes("sécurité")) return ShieldCheck;

  return CircleDot;
}

export default function ChoiceCard({
  choice,
  selected,
  onSelect,
}: {
  choice: ConfiguratorChoice;
  selected: boolean;
  onSelect: () => void;
}) {
  const badge = getChoiceBadge(choice);
  const Icon = getChoiceIcon(choice);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative min-h-[78px] overflow-hidden rounded-[1.1rem] border p-2.5 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-orange-100 ${
        selected
          ? "border-orange-500 bg-gradient-to-br from-orange-50 via-white to-white shadow-lg shadow-orange-100"
          : "border-slate-200 bg-white shadow-sm shadow-slate-200/60 hover:border-[#007f8f]/60 hover:bg-slate-50/70 hover:shadow-slate-200/80"
      }`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-1 transition ${
          selected ? "bg-orange-600" : "bg-transparent group-hover:bg-[#007f8f]"
        }`}
      />

      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border transition ${
            selected
              ? "border-orange-200 bg-orange-100 text-orange-700"
              : "border-slate-200 bg-slate-50 text-[#005466] group-hover:border-[#007f8f]/30 group-hover:bg-[#007f8f]/10"
          }`}
        >
          <Icon size={18} strokeWidth={2.5} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[14px] font-black leading-tight text-slate-950">
              {choice.label}
            </h3>
            {badge && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${
                  choice.recommended
                    ? "bg-orange-100 text-orange-700"
                    : "bg-[#007f8f]/10 text-[#005466]"
                }`}
              >
                {choice.recommended ? <Sparkles size={10} /> : null}
                {badge}
              </span>
            )}
          </div>

          <p className="mt-1 line-clamp-2 text-[12px] leading-[1.15rem] text-slate-600">
            {choice.description}
          </p>
        </div>

        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
            selected
              ? "border-orange-600 bg-orange-600 text-white"
              : "border-slate-200 bg-white text-transparent group-hover:border-[#007f8f] group-hover:text-[#007f8f]"
          }`}
        >
          {selected ? <BadgeCheck size={14} strokeWidth={2.7} /> : <Check size={13} strokeWidth={3} />}
        </span>
      </div>
    </button>
  );
}
