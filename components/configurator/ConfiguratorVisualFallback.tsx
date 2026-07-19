"use client";

import { CheckCircle2, Cuboid, Sparkles } from "lucide-react";
import type { EngineResult } from "@/lib/configurator/types";
import type { ConfiguratorFamilyExperience } from "@/lib/configurator/model-registry";

type Props = {
  configuration: EngineResult;
  experience: ConfiguratorFamilyExperience;
};

export default function ConfiguratorVisualFallback({ experience }: Props) {
  return (
    <div className="relative flex h-full min-h-[440px] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_38%,#173042_0%,#08131f_48%,#020617_100%)] px-5 py-8 text-white md:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] [background-size:34px_34px]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/10" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.06]" />

      <div className="relative z-10 w-full max-w-xl rounded-[2rem] border border-white/12 bg-slate-950/72 p-6 text-center shadow-2xl backdrop-blur-xl md:p-9">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-300/20 bg-orange-500/12 text-orange-400 shadow-[0_0_45px_rgba(249,115,22,.16)]">
          <Cuboid size={31} strokeWidth={1.8} />
        </div>

        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">
          <Sparkles size={13} /> Visualisation 3D en préparation
        </div>

        <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-orange-400">
          {experience.shortLabel}
        </p>
        <h2 className="mt-2 text-3xl font-black leading-tight text-white md:text-4xl">
          {experience.label}
        </h2>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-white/60 md:text-base md:leading-7">
          Cette solution est entièrement configurable. Sa visualisation 3D interactive sera intégrée progressivement afin de garantir une représentation fidèle du produit.
        </p>

        <div className="mx-auto mt-7 max-w-md rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.07] p-4 text-left">
          <div className="flex gap-3">
            <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-300" size={19} />
            <div>
              <p className="text-sm font-black text-white">La configuration reste complète</p>
              <p className="mt-1 text-xs leading-5 text-white/55">
                Les choix techniques, les contrôles de compatibilité et le calcul du prix fonctionnent normalement.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.17em] text-white/30">
          Les modèles 3D OYSTE sont ajoutés famille par famille
        </p>
      </div>
    </div>
  );
}
