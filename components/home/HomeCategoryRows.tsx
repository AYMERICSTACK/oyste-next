"use client";

import { ArrowRight, ChevronRight } from "lucide-react";
import { useRef } from "react";

export type HomeCategoryRow = {
  slug: string;
  title: string;
  href: string;
  imageUrl: string;
  children: Array<{ title: string; href: string; imageUrl?: string }>;
};

function CategoryRow({ row }: { row: HomeCategoryRow }) {
  const railRef = useRef<HTMLDivElement>(null);
  const scrollNext = () => railRef.current?.scrollBy({ left: Math.max(260, railRef.current.clientWidth * 0.72), behavior: "smooth" });

  return (
    <article className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm lg:grid-cols-[235px_minmax(0,1fr)]">
      <a href={row.href} className="group relative min-h-[150px] overflow-hidden rounded-xl bg-slate-950 text-white">
        <img src={row.imageUrl} alt="" className="absolute inset-0 h-full w-full object-contain p-3 opacity-70 transition duration-300 group-hover:scale-105 group-hover:opacity-85" />
        <span className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent" />
        <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
          <span><span className="block text-[10px] font-black uppercase tracking-[0.2em] text-orange-400">Catégorie</span><strong className="mt-1 block text-lg font-black uppercase leading-tight">{row.title}</strong></span>
          <ArrowRight size={18} className="shrink-0 text-orange-400 transition group-hover:translate-x-1" />
        </span>
      </a>

      <div className="relative min-w-0">
        <div ref={railRef} className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 pr-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {row.children.map((child) => (
            <a key={child.href} href={child.href} className="group flex w-[168px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-orange-400 hover:shadow-md sm:w-[185px]">
              <div className="flex h-24 items-center justify-center bg-slate-50">
                {child.imageUrl ? <img src={child.imageUrl} alt="" className="h-full w-full object-contain p-2.5 transition group-hover:scale-105" /> : <span className="px-3 text-center text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Visuel non disponible</span>}
              </div>
              <span className="flex min-h-14 flex-1 items-center justify-between gap-2 px-3 py-2.5"><strong className="line-clamp-2 text-sm leading-5 text-slate-950">{child.title}</strong><ArrowRight size={14} className="shrink-0 text-orange-600 transition group-hover:translate-x-1" /></span>
            </a>
          ))}
        </div>
        {row.children.length > 3 ? <button type="button" onClick={scrollNext} aria-label={`Voir davantage de sous-catégories ${row.title}`} className="absolute right-0 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-950 shadow-lg transition hover:border-orange-400 hover:text-orange-600"><ChevronRight size={20} /></button> : null}
      </div>
    </article>
  );
}

export default function HomeCategoryRows({ rows }: { rows: HomeCategoryRow[] }) {
  return <div className="mt-5 space-y-4">{rows.map((row) => <CategoryRow key={row.slug} row={row} />)}</div>;
}
