"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

export type HomeHeroSlide = {
  title: string;
  text: string;
  href: string;
  image: string;
  label: string;
  ctaLabel?: string;
};

export default function HomeHeroCarousel({ slides }: { slides: HomeHeroSlide[] }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => setActive((value) => (value + 1) % slides.length), 6500);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const previous = () => setActive((value) => (value - 1 + slides.length) % slides.length);
  const next = () => setActive((value) => (value + 1) % slides.length);
  const slide = slides[active % slides.length];
  if (!slide) return null;

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-xl shadow-slate-300/35">
      <div className="relative aspect-[16/8] min-h-[245px]">
        {slides.map((item, index) => (
          <img
            key={`${item.label}-${index}`}
            src={item.image}
            alt=""
            aria-hidden={index !== active}
            className={`absolute inset-0 h-full w-full object-contain p-6 transition-opacity duration-500 ${index === active ? "opacity-100" : "opacity-0"}`}
          />
        ))}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-transparent px-5 pb-4 pt-14 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-300">{slide.label}</p>
          <h2 className="mt-1 text-xl font-black">{slide.title}</h2>
          <div className="mt-2 flex items-end justify-between gap-5">
            <p className="max-w-lg text-xs font-medium leading-5 text-slate-100 sm:text-sm">{slide.text}</p>
            <a href={slide.href} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-sm font-black text-white transition hover:bg-orange-700">
              {slide.ctaLabel ?? "Découvrir"} <ArrowRight size={17} />
            </a>
          </div>
        </div>
      </div>
      {slides.length > 1 && <>
        <button type="button" onClick={previous} aria-label="Diapositive précédente" className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-md hover:bg-white"><ChevronLeft size={22} /></button>
        <button type="button" onClick={next} aria-label="Diapositive suivante" className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-md hover:bg-white"><ChevronRight size={22} /></button>
      </>}
      <div className="absolute bottom-3 left-6 flex gap-2" aria-label="Choisir une catégorie">
        {slides.map((item, index) => (
          <button
            key={`${item.label}-${index}`}
            type="button"
            onClick={() => setActive(index)}
            className={`h-1.5 rounded-full transition-all ${index === active ? "w-8 bg-orange-400" : "w-3 bg-white/45"}`}
            aria-label={`Afficher ${item.label}`}
          />
        ))}
      </div>
    </div>
  );
}
