import { Ruler, TowerControl, Weight } from "lucide-react";
import type { Configurator3DState } from "@/lib/configurator/model-types";

export default function Configurator3DOverlay({ state }: { state: Configurator3DState }) {
  const metrics = [
    { label: "Charge", value: state.capacity, icon: Weight },
    { label: "Portée", value: state.reach, icon: Ruler },
    { label: "Hauteur", value: state.height, icon: TowerControl },
  ];

  return (
    <>
      <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 grid grid-cols-3 gap-1.5">
        {metrics.map(({ label, value, icon: Icon }) => (
          <div key={label} className="min-w-0 rounded-xl border border-white/15 bg-slate-950/75 px-2.5 py-2 text-white shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-1.5 text-white/55">
              <Icon size={12} />
              <p className="truncate text-[8px] font-black uppercase tracking-[0.12em]">{label}</p>
            </div>
            <p className="mt-1 truncate text-[11px] font-black">{value ?? "À choisir"}</p>
          </div>
        ))}
      </div>
    </>
  );
}
