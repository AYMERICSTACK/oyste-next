import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CatalogueUniverse } from "@/data/catalogue";

export default function CategoryCard({
  title,
  subtitle,
  countLabel,
  description,
  icon: Icon,
  accent,
  href = "#",
  mode,
  tags,
}: CatalogueUniverse) {
  return (
    <a
      href={href}
      className="group relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-orange-500 hover:shadow-xl"
    >
      <div className={cn("absolute right-5 top-5 h-3 w-16 rounded-full", accent)} />

      <div className="flex aspect-[4/3] items-center justify-center rounded-3xl bg-slate-50 text-[#007f8f] transition group-hover:bg-[#007f8f] group-hover:text-white">
        <Icon size={72} strokeWidth={1.5} />
      </div>

      <div className="pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-black text-slate-500">{countLabel}</p>
          {mode === "assistant" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-black uppercase text-orange-700">
              <Sparkles size={12} /> Guidé
            </span>
          )}
        </div>
        <h2 className="mt-2 text-2xl font-black text-slate-950">{title}</h2>
        <p className="mt-1 text-sm font-black uppercase tracking-[0.16em] text-[#005466]">
          {subtitle}
        </p>
        <p className="mt-3 min-h-18 text-sm leading-6 text-slate-600">
          {description}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600"
            >
              {tag}
            </span>
          ))}
        </div>

        <p className="mt-6 flex items-center gap-2 text-sm font-black text-orange-600">
          {mode === "assistant" ? "Configurer" : "Découvrir"}
          <ArrowRight size={18} className="transition group-hover:translate-x-1" />
        </p>
      </div>
    </a>
  );
}
