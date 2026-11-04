"use client";

import { useState } from "react";
import ProductMediaFrame from "@/components/catalogue/ProductMediaFrame";

export default function StockmanProductGallery({ images, title, reference }: { images: string[]; title: string; reference: string }) {
  const uniqueImages = [...new Set(images.filter(Boolean))];
  const [selected, setSelected] = useState(0);
  const current = uniqueImages[selected] || uniqueImages[0] || "";
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-slate-500">Cliquez sur l'image pour l'agrandir</p>
        <span className="rounded-full bg-[#007f8f]/10 px-3 py-1 text-xs font-black text-[#007f8f]">{reference}</span>
      </div>
      <a href={current} target="_blank" rel="noopener noreferrer" aria-label="Agrandir la photo du produit" className="block overflow-hidden rounded-2xl bg-white">
        <ProductMediaFrame src={current} alt={title} label={reference} variant="card" />
      </a>
      {uniqueImages.length > 1 ? (
        <div className="mt-4 flex flex-wrap gap-3">
          {uniqueImages.map((image, index) => (
            <button type="button" key={image} onClick={() => setSelected(index)} aria-label={`Afficher la vue ${index + 1}`} aria-pressed={selected === index} className={`w-20 overflow-hidden rounded-xl border-2 p-1 transition ${selected === index ? "border-[#007f8f]" : "border-slate-200 hover:border-[#007f8f]/50"}`}>
              <img src={image} alt={`${title} - vue ${index + 1}`} loading="lazy" className="h-16 w-full object-contain" />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
