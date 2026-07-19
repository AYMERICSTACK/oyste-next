import { Lock, Plus, X } from "lucide-react";
import { formatPrice } from "@/lib/configurator/pricing";
import type { Accessory } from "@/lib/configurator/types";

export default function CompatibilityCard({
  line,
  selected,
  locked = false,
  onToggle,
}: {
  line: Accessory;
  selected: boolean;
  locked?: boolean;
  onToggle: () => void;
}) {
  const Icon = line.icon;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full rounded-3xl border p-5 text-left transition hover:-translate-y-1 hover:shadow-xl ${
        selected
          ? "border-[#007f8f] bg-[#007f8f]/5"
          : "border-slate-200 bg-white hover:border-orange-500"
      } ${locked ? "cursor-default" : ""}`}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-[#005466]">
          <Icon size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-black text-slate-950">{line.label}</h3>
              {locked && (
                <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-[#007f8f]">
                  ajouté automatiquement
                </p>
              )}
            </div>
            <span className="shrink-0 font-black text-orange-600">
              {line.price === 0 ? "Inclus" : formatPrice(line.price)} HT
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{line.description}</p>
        </div>
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            selected ? "bg-[#007f8f] text-white" : "bg-slate-950 text-white"
          }`}
        >
          {locked ? <Lock size={16} /> : selected ? <X size={17} /> : <Plus size={17} />}
        </span>
      </div>
    </button>
  );
}
