"use client";

import { formatCmuText, formatTechnicalValue } from "@/lib/catalogue/format-cmu-display";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileQuestion,
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
import { getSupplierLeadTimeInfo } from "@/lib/catalogue/supplier-lead-time";
import { calculateKitoDynamicWeightKg, getKitoChainWeightRule, getRequestedKitoLiftM } from "@/lib/shipping/kito-chain-weight";
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

function buildOptionSchema(
  variants: CatalogueVariant[],
  configuredSchema: CatalogueOption[],
) {
  if (configuredSchema.length) return configuredSchema;

  const valuesByLabel = new Map<string, Set<string>>();
  for (const variant of variants) {
    for (const [label, value] of Object.entries(variant.options || {})) {
      if (!label || !value) continue;
      if (!valuesByLabel.has(label)) valuesByLabel.set(label, new Set());
      valuesByLabel.get(label)?.add(value);
    }
  }

  return Array.from(valuesByLabel.entries()).map(([label, values]) => ({
    label,
    values: Array.from(values),
  }));
}

function optionCombinationExists(
  variants: CatalogueVariant[],
  current: Record<string, string>,
  label: string,
  value: string,
) {
  // Une option de premier niveau doit rester cliquable dès lors qu'au moins
  // une variante existe avec cette valeur. On ne doit pas la griser simplement
  // parce que les autres choix courants appartiennent à une autre branche.
  const directCandidates = variants.filter(
    (variant) => variant.options?.[label] === value,
  );
  if (!directCandidates.length) return false;

  // Si une combinaison exacte existe avec les autres choix courants, parfait.
  const exactExists = directCandidates.some((variant) =>
    Object.entries(current).every(([optionLabel, optionValue]) => {
      if (optionLabel === label || !optionValue) return true;
      return variant.options?.[optionLabel] === optionValue;
    }),
  );
  if (exactExists) return true;

  // Sinon la valeur reste disponible : updateOption choisira automatiquement
  // la variante sœur la plus proche en conservant le maximum des autres choix.
  return true;
}

type KitoChainPricingResponse = {
  baseLiftM: number;
  sellingPricePerMeterHT: number;
};

function stockLabel(stock: number | null | undefined) {
  if (typeof stock !== "number") return "Disponibilité à confirmer";
  if (stock <= 0) return "Sur demande";
  if (stock === 1) return "1 en stock";
  return `${stock} en stock`;
}


export default function ProductVariantSelector({
  productName,
  productCode,
  parentCode,
  supplier,
  productWeightKg,
  productShippingMode,
  variants,
  optionSchema,
  initialVariantCode,
  isConfiguratorProduct = false,
  configuratorHref = "/configurateur",
  productHref,
  familyLabel,
  galleryImages = [],
  variantGalleryImages = {},
  documentCount = 0,
}: {
  productName: string;
  productCode: string;
  parentCode: string;
  supplier?: string;
  productWeightKg?: number | null;
  productShippingMode?: "INCLUDED" | "MESSAGERIE" | "AFFRETEMENT" | "QUOTE";
  variants: CatalogueVariant[];
  optionSchema: CatalogueOption[];
  initialVariantCode?: string;
  isConfiguratorProduct?: boolean;
  configuratorHref?: string;
  productHref?: string;
  familyLabel?: string;
  galleryImages?: string[];
  variantGalleryImages?: Record<string, string[]>;
  documentCount?: number;
}) {
  const effectiveOptionSchema = useMemo(
    () => buildOptionSchema(variants, optionSchema),
    [optionSchema, variants],
  );

  const initialOptions = useMemo(() => {
    const requestedVariant = initialVariantCode
      ? variants.find(
          (variant) =>
            variant.code.trim().toLocaleLowerCase("fr") ===
            initialVariantCode.trim().toLocaleLowerCase("fr"),
        )
      : null;
    const initialVariant = requestedVariant || variants[0];

    return Object.fromEntries(
      effectiveOptionSchema.map((option) => [
        option.label,
        initialVariant?.options?.[option.label] || option.values[0] || "",
      ]),
    );
  }, [effectiveOptionSchema, initialVariantCode, variants]);

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(initialOptions);

  useEffect(() => {
    setSelectedOptions(initialOptions);
  }, [initialOptions]);

  const selectedVariant = findMatchingVariant(variants, selectedOptions);
  const variantTechnicalLines = useMemo(
    () => Object.entries(selectedVariant?.options || {}).map(([label, value]) => ({ label, value })),
    [selectedVariant],
  );
  const existingKitoLiftM = getRequestedKitoLiftM(variantTechnicalLines);
  const kitoChainRule = /^KITO$/i.test(String(supplier || "").trim())
    ? getKitoChainWeightRule(selectedVariant?.code || productCode)
    : null;
  const needsDynamicKitoLift = Boolean(kitoChainRule && existingKitoLiftM === null);
  const [kitoLiftM, setKitoLiftM] = useState<number | null>(null);
  const [kitoChainPricing, setKitoChainPricing] = useState<KitoChainPricingResponse | null>(null);
  const [kitoPricingLoading, setKitoPricingLoading] = useState(false);

  useEffect(() => {
    const code = selectedVariant?.code || productCode;
    const rule = /^KITO$/i.test(String(supplier || "").trim())
      ? getKitoChainWeightRule(code)
      : null;
    const hasLiftAlready = getRequestedKitoLiftM(
      Object.entries(selectedVariant?.options || {}).map(([label, value]) => ({ label, value })),
    ) !== null;

    if (!rule || hasLiftAlready) {
      setKitoLiftM(null);
      setKitoChainPricing(null);
      setKitoPricingLoading(false);
      return;
    }

    setKitoLiftM(rule.baseLiftM);
    setKitoChainPricing(null);
    setKitoPricingLoading(true);
    const controller = new AbortController();

    fetch(`/api/catalogue/kito-chain-pricing?code=${encodeURIComponent(code)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Tarif chaîne indisponible");
        return (await response.json()) as KitoChainPricingResponse;
      })
      .then((pricing) => setKitoChainPricing(pricing))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setKitoChainPricing(null);
      })
      .finally(() => setKitoPricingLoading(false));

    return () => controller.abort();
  }, [productCode, selectedVariant?.code, selectedVariant?.options, supplier]);
  const leadTimeInfo = getSupplierLeadTimeInfo({
    supplier,
    stock: selectedVariant?.stock,
    configuredDelay: selectedVariant?.delay,
    isConfiguratorProduct,
  });
  const resolvedImageUrl = getProductImageUrl(
    selectedVariant?.imageRef || productCode,
    selectedVariant?.code || productCode,
    parentCode,
  );

  const isGenericFallback =
    resolvedImageUrl === "/images/hero-potence.png";
  const selectedVariantImages = selectedVariant?.code
    ? variantGalleryImages[selectedVariant.code] || []
    : [];

  // Pour une fiche à variantes, la galerie suit strictement la référence
  // sélectionnée. Cela évite de mélanger des visuels appartenant à d'autres
  // capacités ou dimensions de la même famille (ex. marquage 1000 kg sur une
  // variante 8 t). La galerie produit générale ne sert que de repli lorsqu'il
  // n'existe aucun média exact pour la variante.
  const images = useMemo(() => {
    if (selectedVariantImages.length) {
      return Array.from(new Set(selectedVariantImages.filter(Boolean))).slice(0, 8);
    }

    const ordered = galleryImages.length
      ? [...galleryImages, ...(isGenericFallback ? [] : [resolvedImageUrl])]
      : [resolvedImageUrl];

    return Array.from(new Set(ordered.filter(Boolean))).slice(0, 8);
  }, [galleryImages, isGenericFallback, resolvedImageUrl, selectedVariantImages]);

  const preferredImage = images[0] || resolvedImageUrl;

  const [selectedGalleryImage, setSelectedGalleryImage] = useState<string | null>(null);

  useEffect(() => {
    // Quand la variante change, revenir sur son meilleur visuel disponible.
    setSelectedGalleryImage(null);
  }, [selectedVariant?.code]);

  const activeImage =
    selectedGalleryImage && images.includes(selectedGalleryImage)
      ? selectedGalleryImage
      : preferredImage;
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const hasOptions = variants.length > 1 && effectiveOptionSchema.length > 0;

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
      const requested = { ...current, [label]: value };

      const exact = variants.find((variant) =>
        Object.entries(requested).every(
          ([optionLabel, optionValue]) =>
            !optionValue || variant.options?.[optionLabel] === optionValue,
        ),
      );
      if (exact) return { ...exact.options };

      // Si la combinaison n'existe pas, on garde le choix de l'utilisateur
      // et on sélectionne la variante disponible qui respecte ce choix tout
      // en conservant le maximum des autres options déjà sélectionnées.
      const candidates = variants.filter(
        (variant) => variant.options?.[label] === value,
      );

      const best = candidates
        .map((variant) => ({
          variant,
          score: Object.entries(current).reduce(
            (score, [optionLabel, optionValue]) =>
              optionLabel !== label &&
              optionValue &&
              variant.options?.[optionLabel] === optionValue
                ? score + 1
                : score,
            0,
          ),
        }))
        .sort((a, b) => b.score - a.score)[0]?.variant;

      return best ? { ...best.options } : requested;
    });
  }

  function moveImage(direction: number) {
    if (!images.length) return;
    const currentIndex = Math.max(0, images.indexOf(activeImage));
    const nextIndex = (currentIndex + direction + images.length) % images.length;
    setSelectedGalleryImage(images[nextIndex]);
  }

  const effectiveKitoLiftM = needsDynamicKitoLift && kitoChainRule
    ? Math.max(kitoChainRule.baseLiftM, kitoLiftM ?? kitoChainRule.baseLiftM)
    : existingKitoLiftM;
  const extraKitoLiftM = needsDynamicKitoLift && kitoChainRule && effectiveKitoLiftM !== null
    ? Math.max(0, effectiveKitoLiftM - kitoChainRule.baseLiftM)
    : 0;
  const kitoChainSupplementHT = extraKitoLiftM > 0 && kitoChainPricing
    ? Math.round(extraKitoLiftM * kitoChainPricing.sellingPricePerMeterHT * 100) / 100
    : 0;
  const displayedPriceHT = (selectedVariant?.priceHT || 0) + kitoChainSupplementHT;
  const cartTechnicalLines = needsDynamicKitoLift && effectiveKitoLiftM !== null
    ? [...variantTechnicalLines, { label: "Hauteur de levage", value: `${effectiveKitoLiftM} m` }]
    : variantTechnicalLines;
  const displayedWeightKg = calculateKitoDynamicWeightKg({
    supplier,
    code: selectedVariant?.code || productCode,
    baseWeightKg: selectedVariant?.weightKg ?? productWeightKg ?? undefined,
    technicalLines: cartTechnicalLines,
  });
  const dynamicKitoPricingReady = extraKitoLiftM <= 0 || Boolean(kitoChainPricing);
  const kitoCartItemId = needsDynamicKitoLift && effectiveKitoLiftM !== null
    ? `catalogue:${selectedVariant?.code || productCode}:lift:${effectiveKitoLiftM}`
    : undefined;

  return (
    <>
      <section id="galerie-produit" className="scroll-mt-28 grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
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
                {formatCmuText(selectedVariant?.label || selectedVariant?.name || productName)}
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
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#007f8f] shadow-sm">
                  <SlidersHorizontal size={18} />
                </span>
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.22em] text-[#005466]">
                    Choisissez votre configuration
                  </p>
                  <p className="mt-1 text-xs font-bold leading-5 text-slate-600">
                    Les choix impossibles sont automatiquement écartés. La référence, le prix, le stock et le poids se mettent à jour instantanément.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-5">
                {effectiveOptionSchema.map((option) => (
                  <fieldset key={option.label}>
                    <legend className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-600">
                      {option.label}
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {option.values.map((value) => {
                        const active = selectedOptions[option.label] === value;
                        const available = optionCombinationExists(
                          variants,
                          selectedOptions,
                          option.label,
                          value,
                        );

                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => updateOption(option.label, value)}
                            disabled={!available && !active}
                            className={`rounded-xl border px-4 py-2.5 text-sm font-black transition ${
                              active
                                ? "border-[#007f8f] bg-[#007f8f] text-white shadow-sm"
                                : available
                                  ? "border-slate-200 bg-white text-slate-700 hover:border-[#007f8f]/50 hover:text-[#005466]"
                                  : "cursor-not-allowed border-slate-100 bg-slate-100 text-slate-300"
                            }`}
                          >
                            {formatTechnicalValue(option.label, value)}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>

              {selectedVariant ? (
                <div className="mt-5 grid gap-3 rounded-2xl bg-white p-4 sm:grid-cols-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Référence</p>
                    <p className="mt-1 text-sm font-black text-slate-950">{selectedVariant.code}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Stock</p>
                    <p className="mt-1 text-sm font-black text-slate-950">{stockLabel(selectedVariant.stock)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Poids</p>
                    <p className="mt-1 text-sm font-black text-slate-950">
                      {selectedVariant.weightKg ? `${selectedVariant.weightKg} kg` : "À confirmer"}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {needsDynamicKitoLift && kitoChainRule ? (
            <div className="mt-7 rounded-3xl border border-orange-200 bg-orange-50 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-700">Hauteur de levage KITO</p>
                  <p className="mt-1 text-sm font-bold leading-5 text-slate-600">
                    Hauteur standard : {kitoChainRule.baseLiftM} m. Le supplément de chaîne est calculé automatiquement au mètre.
                  </p>
                </div>
                <label className="block min-w-[170px]">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-600">Hauteur souhaitée</span>
                  <div className="flex items-center rounded-xl border border-orange-200 bg-white px-3 shadow-sm">
                    <input
                      type="number"
                      min={kitoChainRule.baseLiftM}
                      step="1"
                      value={effectiveKitoLiftM ?? kitoChainRule.baseLiftM}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        setKitoLiftM(Number.isFinite(value) ? Math.max(kitoChainRule.baseLiftM, value) : kitoChainRule.baseLiftM);
                      }}
                      className="w-full bg-transparent py-3 text-right text-base font-black text-slate-950 outline-none"
                      aria-label="Hauteur de levage KITO en mètres"
                    />
                    <span className="ml-2 text-sm font-black text-slate-500">m</span>
                  </div>
                </label>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Chaîne supplémentaire</p>
                  <p className="mt-1 text-sm font-black text-slate-950">+{extraKitoLiftM} m</p>
                </div>
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Supplément HT</p>
                  <p className="mt-1 text-sm font-black text-slate-950">
                    {extraKitoLiftM <= 0
                      ? "0 €"
                      : kitoPricingLoading
                        ? "Calcul..."
                        : kitoChainPricing
                          ? formatPriceHT(kitoChainSupplementHT)
                          : "À confirmer"}
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Poids calculé</p>
                  <p className="mt-1 text-sm font-black text-slate-950">
                    {typeof displayedWeightKg === "number" && displayedWeightKg > 0 ? `${displayedWeightKg} kg` : "À confirmer"}
                  </p>
                </div>
              </div>

              {extraKitoLiftM > 0 && !kitoPricingLoading && !kitoChainPricing ? (
                <p className="mt-3 text-xs font-bold text-orange-800">
                  Le tarif ERP du mètre supplémentaire n'est pas disponible pour cette référence : commande sur devis pour cette hauteur.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-7 rounded-[1.75rem] bg-slate-950 p-5 text-white">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                  {isConfiguratorProduct ? "Prix calculé après configuration" : "Prix HT"}
                </p>
                <p className="mt-2 text-3xl font-black text-orange-400">
                  {isConfiguratorProduct ? "Sur mesure" : formatPriceHT(displayedPriceHT)}
                </p>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Disponibilité</p>
                <p className="mt-1 text-sm font-black text-white">{leadTimeInfo.label}</p>
                <p className="mt-1 max-w-[360px] text-[10px] font-semibold leading-4 text-slate-300">{leadTimeInfo.note}</p>
                {leadTimeInfo.url ? (
                  <a href={leadTimeInfo.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-[10px] font-black text-cyan-300 underline underline-offset-2">
                    Voir les délais COMEGÉ
                  </a>
                ) : null}
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
            ) : ((selectedVariant?.priceHT || 0) > 0 && dynamicKitoPricingReady ? (
              <AddToCartButton
                name={formatCmuText(selectedVariant?.label || selectedVariant?.name || productName)}
                code={selectedVariant?.code || productCode}
                family={familyLabel}
                supplier={supplier}
                weightKg={typeof displayedWeightKg === "number" ? displayedWeightKg : selectedVariant?.weightKg ?? productWeightKg ?? undefined}
                shippingMode={selectedVariant?.shippingMode ?? productShippingMode}
                imageUrl={preferredImage}
                priceHT={displayedPriceHT}
                delay={selectedVariant?.delay}
                href={productHref}
                technicalLines={cartTechnicalLines}
                cartItemId={kitoCartItemId}
              />
            ) : (
              <Button href="#demande-devis" className="w-full justify-center py-4 text-base">
                Demander un devis <FileQuestion size={18} />
              </Button>
            ))}
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
              {isConfiguratorProduct ? "Sur mesure" : formatPriceHT(displayedPriceHT)}
            </p>
          </div>
          {isConfiguratorProduct ? (
            <a href={configuratorHref} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white">
              Configurer <ArrowRight size={17} />
            </a>
          ) : ((selectedVariant?.priceHT || 0) > 0 && dynamicKitoPricingReady ? (
            <AddToCartButton
              name={formatCmuText(selectedVariant?.label || selectedVariant?.name || productName)}
              code={selectedVariant?.code || productCode}
              family={familyLabel}
              supplier={supplier}
              weightKg={typeof displayedWeightKg === "number" ? displayedWeightKg : selectedVariant?.weightKg ?? productWeightKg ?? undefined}
              shippingMode={selectedVariant?.shippingMode ?? productShippingMode}
              imageUrl={preferredImage}
              priceHT={displayedPriceHT}
              delay={selectedVariant?.delay}
              href={productHref}
              technicalLines={cartTechnicalLines}
              cartItemId={kitoCartItemId}
            />
          ) : (
            <a href="#demande-devis" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-black text-white">
              Devis <FileQuestion size={17} />
            </a>
          ))}
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
