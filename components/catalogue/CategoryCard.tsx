import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CatalogueUniverse } from "@/data/catalogue";
import { getProductImageUrl } from "@/lib/product-images";
import { getProductMediaImages, getProductsByCategory } from "@/lib/catalogue/repository";

export default function CategoryCard({
  slug,
  title,
  subtitle,
  countLabel: _countLabel,
  description: _description,
  icon: _Icon,
  accent,
  href = "#",
  mode,
  tags,
}: CatalogueUniverse) {
  const representativeProduct = getProductsByCategory(slug)[0];
  const imageUrl = representativeProduct
    ? getProductMediaImages(representativeProduct)[0] || getProductImageUrl(representativeProduct.imageRef, representativeProduct.code)
    : getProductImageUrl(slug);

  return (
    <a
      href={href}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:border-orange-500 hover:shadow-lg"
    >
      <div className={cn("absolute right-5 top-5 h-3 w-16 rounded-full", accent)} />

      <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-slate-50">
        <img
          src={imageUrl}
          alt={title}
          className="h-full w-full object-contain p-5 transition duration-300 group-hover:scale-105"
        />
      </div>

      <div className="pt-4">
        <div className="flex flex-wrap items-center gap-2">
          {mode === "assistant" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-black uppercase text-orange-700">
              <Sparkles size={12} /> Guidé
            </span>
          )}
        </div>
        <h2 className="mt-2 text-xl font-black text-slate-950">{title}</h2>
        <p className="mt-1 text-sm font-black uppercase tracking-[0.16em] text-[#005466]">
          {subtitle}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600"
            >
              {tag}
            </span>
          ))}
        </div>

        <p className="mt-4 flex items-center gap-2 text-sm font-black text-orange-600">
          {mode === "assistant" ? "Configurer" : "Découvrir"}
          <ArrowRight size={18} className="transition group-hover:translate-x-1" />
        </p>
      </div>
    </a>
  );
}
