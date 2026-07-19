"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Headphones,
  ImageIcon,
  Layers3,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  X,
  ZoomIn,
} from "lucide-react";
import Button from "@/components/ui/Button";
import AddToCartButton from "@/components/cart/AddToCartButton";
import { getProductImageUrl } from "@/lib/product-images";
import ProductMediaFrame from "./ProductMediaFrame";
import {
  formatPriceHT,
  type CatalogueOption,
  type CatalogueVariant,
} from "@/lib/catalogue/repository";

function findMatchingVariant(
  variants: CatalogueVariant[],
  selectedOptions: Record<string, string>,
) {
  return (
    variants.find((variant) =>
      Object.entries(selectedOptions).every(
        ([label, value]) => !value || variant.options?.[label] === value,
      ),
    ) || variants[0]
  );
}

export default function ProductVariantSelector({
  productName,
  productCode,
  parentCode,
  variants,
  optionSchema,
  isConfiguratorProduct = false,
  configuratorHref = "/configurateur",
  productHref,
  familyLabel,
  galleryImages = [],
  documentCount = 0,
}: {
  productName: string;
  productCode: string;
  parentCode: string;
  variants: CatalogueVariant[];
  optionSchema: CatalogueOption[];
  isConfiguratorProduct?: boolean;
  configuratorHref?: string;
  productHref?: string;
  familyLabel?: string;
  galleryImages?: string[];
  documentCount?: number;
}) {
  const initialOptions = useMemo(() => {
    const firstVariant = variants[0];
    return Object.fromEntries(
      optionSchema.map((option) => [option.label, firstVariant?.options?.[option.label] || option.values[0] || ""]),
    );
  }, [optionSchema, variants]);

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(initialOptions);
  const selectedVariant = findMatchingVariant(variants, selectedOptions);
  const imageUrl = getProductImageUrl(
    selectedVariant?.imageRef || productCode,
    selectedVariant?.code || productCode,
    parentCode,
  );
  const images = useMemo(
    () => Array.from(new Set([imageUrl, ...galleryImages].filter(Boolean))).slice(0, 8),
    [galleryImages, imageUrl],
  );
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<string | null>(null);
  const activeImage = selectedGalleryImage && images.includes(selectedGalleryImage) ? selectedGalleryImage : imageUrl;
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const hasOptions = variants.length > 1 && optionSchema.length > 0;

  useEffect(() => {
    if (!lightboxOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [lightboxOpen]);

  function updateOption(label: string, value: string) {
    setSelectedOptions((current) => {
      const next = { ...current, [label]: value };
      const directMatch = findMatchingVariant(variants, next);
      if (directMatch) return { ...directMatch.options, [label]: value };
      return next;
    });
  }

  function moveImage(direction: number) {
    if (!images.length) return;
    const currentIndex = Math.max(0, images.indexOf(activeImage));
    const nextIndex = (currentIndex + direction + images.length) % images.length;
    setSelectedGalleryImage(images[nextIndex]);
  }

  const cartTechnicalLines = Object.entries(selectedVariant?.options || {}).map(([label, value]) => ({ label, value }));

  return (
    <>
      <section className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
        <div className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-sm lg:sticky lg:top-24">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Galerie produit</p>
              <p className="mt-1 text-sm font-bold text-slate-600">Cliquez sur l&apos;image pour l&apos;agrandir</p>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#007f8f]/10 text-[#007f8f]">
              <ImageIcon size={20} />
            </span>
          </div>

          <button
            type="button"
            onClick={() => activeImage && setLightboxOpen(true)}
            className="group relative block w-full cursor-zoom-in text-left"
            aria-label="Agrandir le visuel produit"
          >
            <ProductMediaFrame
              src={activeImage}
              alt={selectedVariant?.name || productName}
              label={selectedVariant?.code || productCode}
              documentCount={documentCount}
              variant="hero"
              interactive
            />
            {activeImage ? (
              <span className="absolute bottom-5 right-5 z-10 inline-flex items-center gap-2 rounded-full bg-slate-950/90 px-4 py-2 text-xs font-black text-white shadow-lg backdrop-blur transition group-hover:bg-[#007f8f]">
                <ZoomIn size={16} /> Agrandir
              </span>
            ) : null}
          </button>

          <div className="grid grid-cols-4 gap-3 border-t border-slate-100 p-4 sm:grid-cols-5">
            {images.map((thumbnail, index) => (
              <button
                key={`${thumbnail}-${index}`}
                type="button"
                onClick={() => setSelectedGalleryImage(thumbnail)}
                className={`group/thumb overflow-hidden rounded-2xl border bg-white p-2 transition hover:border-[#007f8f] hover:shadow-sm ${
                  activeImage === thumbnail ? "border-[#007f8f] ring-2 ring-[#007f8f]/15" : "border-slate-200"
                }`}
                aria-label={`Afficher le visuel ${index + 1}`}
              >
                <ProductMediaFrame
                  src={thumbnail}
                  alt={`${productName} - visuel ${index + 1}`}
                  variant="thumb"
                  interactive
                  className="rounded-xl"
                />
              </button>
            ))}
            {images.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Visuels en attente
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-600">
                {isConfiguratorProduct ? "Votre solution sur mesure" : "Référence sélectionnée"}
              </p>
              <h2 className="mt-3 text-3xl font-black text-slate-950">
                {selectedVariant?.label || selectedVariant?.name || productName}
              </h2>
              <p className="mt-2 text-sm font-bold text-slate-500">
                Code article · {selectedVariant?.code || productCode}
              </p>
            </div>
            <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 sm:flex">
              <Layers3 size={22} />
            </span>
          </div>

          {hasOptions ? (
            <div className="mt-7 rounded-3xl border border-[#007f8f]/20 bg-[#007f8f]/5 p-5">
              <div className="flex items-center gap-3">
                <SlidersHorizontal size={19} className="text-[#007f8f]" />
                <p className="text-sm font-black uppercase tracking-[0.25em] text-[#005466]">
                  Choisir votre variante
                </p>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {optionSchema.map((option) => (
                  <label key={option.label} className="grid gap-2 text-sm font-black text-slate-700">
                    {option.label}
                    <select
                      value={selectedOptions[option.label] || ""}
                      onChange={(event) => updateOption(option.label, event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-950 outline-none focus:border-[#007f8f]"
                    >
                      {option.values.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-7 rounded-[1.75rem] bg-slate-950 p-5 text-white">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                  {isConfiguratorProduct ? "Prix calculé après configuration" : "Prix HT"}
                </p>
                <p className="mt-2 text-3xl font-black text-orange-400">
                  {isConfiguratorProduct ? "Sur mesure" : formatPriceHT(selectedVariant?.priceHT)}
                </p>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Disponibilité</p>
                <p className="mt-1 text-sm font-black text-white">{selectedVariant?.delay || "Délai confirmé à la commande"}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 p-4">
              <ShieldCheck size={19} className="text-[#007f8f]" />
              <p className="mt-3 text-sm font-black text-slate-950">Achat sécurisé</p>
              <p className="mt-1 text-xs font-bold leading-5 text-slate-500">Parcours clair et références contrôlées.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <Truck size={19} className="text-[#007f8f]" />
              <p className="mt-3 text-sm font-black text-slate-950">Livraison adaptée</p>
              <p className="mt-1 text-xs font-bold leading-5 text-slate-500">Transport selon le matériel commandé.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <Headphones size={19} className="text-[#007f8f]" />
              <p className="mt-3 text-sm font-black text-slate-950">Support OYSTE</p>
              <p className="mt-1 text-xs font-bold leading-5 text-slate-500">Accompagnement avant et après achat.</p>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-slate-500">Points clés</p>
            <div className="mt-4 grid gap-3 text-sm font-bold text-slate-700">
              <div className="flex items-center gap-3 rounded-2xl bg-white p-4">
                <CheckCircle2 size={18} className="shrink-0 text-[#007f8f]" /> Référence : {selectedVariant?.code || productCode}
              </div>
              {selectedVariant?.features?.slice(0, 4).map((feature) => (
                <div key={`${feature.label}-${feature.value}`} className="flex items-start gap-3 rounded-2xl bg-white p-4">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#007f8f]" />
                  <span>{feature.label} : {feature.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-7 grid gap-3">
            {isConfiguratorProduct ? (
              <Button href={configuratorHref} className="w-full justify-center py-4 text-base">
                Configurer ce produit <ArrowRight size={18} />
              </Button>
            ) : (
              <AddToCartButton
                name={selectedVariant?.label || selectedVariant?.name || productName}
                code={selectedVariant?.code || productCode}
                family={familyLabel}
                imageUrl={imageUrl}
                priceHT={selectedVariant?.priceHT || 0}
                delay={selectedVariant?.delay}
                href={productHref}
                technicalLines={cartTechnicalLines}
              />
            )}
            <Button href="#documents-techniques" variant="ghost" className="w-full justify-center">
              Documents techniques {documentCount > 0 ? `(${documentCount})` : ""} <Download size={18} />
            </Button>
          </div>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-12px_30px_rgba(15,23,42,0.12)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-black text-slate-950">{selectedVariant?.label || productName}</p>
            <p className="mt-0.5 text-sm font-black text-orange-600">
              {isConfiguratorProduct ? "Sur mesure" : formatPriceHT(selectedVariant?.priceHT)}
            </p>
          </div>
          {isConfiguratorProduct ? (
            <a href={configuratorHref} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white">
              Configurer <ArrowRight size={17} />
            </a>
          ) : (
            <AddToCartButton
              name={selectedVariant?.label || selectedVariant?.name || productName}
              code={selectedVariant?.code || productCode}
              family={familyLabel}
              imageUrl={imageUrl}
              priceHT={selectedVariant?.priceHT || 0}
              delay={selectedVariant?.delay}
              href={productHref}
              technicalLines={cartTechnicalLines}
            />
          )}
        </div>
      </div>

      {lightboxOpen && activeImage ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/95 p-4" role="dialog" aria-modal="true" aria-label="Galerie produit agrandie">
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute right-5 top-5 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Fermer la galerie"
          >
            <X size={24} />
          </button>
          {images.length > 1 ? (
            <>
              <button type="button" onClick={() => moveImage(-1)} className="absolute left-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20" aria-label="Image précédente">
                <ChevronLeft size={26} />
              </button>
              <button type="button" onClick={() => moveImage(1)} className="absolute right-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20" aria-label="Image suivante">
                <ChevronRight size={26} />
              </button>
            </>
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={activeImage} alt={selectedVariant?.name || productName} className="max-h-[86vh] max-w-[88vw] object-contain" />
        </div>
      ) : null}
    </>
  );
}
