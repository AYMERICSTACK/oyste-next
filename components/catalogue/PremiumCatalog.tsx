"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ExternalLink,
  FileText,
  GitCompareArrows,
  Grid2X2,
  Heart,
  LayoutList,
  Package,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import ProductMediaFrame from "./ProductMediaFrame";

export type PremiumCatalogItem = {
  id: string;
  code: string;
  name: string;
  family: string;
  description: string;
  href: string;
  imageUrl: string;
  priceLabel: string;
  minPriceHT: number | null;
  badge: string;
  badges: string[];
  documentCount: number;
  variantCount: number;
  experienceType: "STANDARD" | "CONFIGURABLE";
  stock: number | null;
  delay: string;
  manufacturer: string;
  capacityLabel: string;
  capacityKg: number | null;
  productType: string;
};

type ViewMode = "grid" | "list";
type SortMode =
  | "recommended"
  | "availability"
  | "price-asc"
  | "price-desc"
  | "capacity-asc"
  | "capacity-desc"
  | "documents"
  | "variants"
  | "name";
type AvailabilityMode = "all" | "available" | "order";

const PAGE_SIZE = 18;

const SORT_LABELS: Record<SortMode, string> = {
  recommended: "Recommandés",
  availability: "Disponibilité",
  "price-asc": "Prix croissant",
  "price-desc": "Prix décroissant",
  "capacity-asc": "CMU croissante",
  "capacity-desc": "CMU décroissante",
  documents: "Les plus documentés",
  variants: "Plus de variantes",
  name: "Nom A–Z",
};

function getBadgeClasses(label: string) {
  const value = normalize(label);
  if (/promo|offre|prix/.test(value))
    return "border-orange-200 bg-orange-50 text-orange-700";
  if (/nouveau|nouveaute/.test(value))
    return "border-violet-200 bg-violet-50 text-violet-700";
  if (/sur mesure|configur|dimensionnement|etude/.test(value))
    return "border-[#007f8f]/20 bg-[#007f8f]/10 text-[#005466]";
  if (/achat en ligne|disponible|livraison/.test(value))
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (/oyste|selection/.test(value))
    return "border-orange-200 bg-orange-50 text-orange-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function getRecommendationScore(
  product: PremiumCatalogItem,
  originalIndex: number,
) {
  const badges = normalize(product.badges.join(" "));
  let score = 0;
  if (product.stock === null || product.stock > 0) score += 24;
  if (product.experienceType === "CONFIGURABLE") score += 18;
  if (product.documentCount > 0)
    score += Math.min(product.documentCount, 5) * 4;
  if (product.variantCount > 1) score += Math.min(product.variantCount, 12);
  if (product.minPriceHT !== null) score += 4;
  if (/selection oyste|nouveau|nouveaute|best|vedette/.test(badges))
    score += 28;
  if (/achat en ligne|disponible/.test(badges)) score += 10;
  return score * 10_000 - originalIndex;
}

function ProductBadge({ label }: { label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black ${getBadgeClasses(label)}`}
    >
      <Sparkles size={11} strokeWidth={2.5} />
      {label}
    </span>
  );
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "fr"),
  );
}

function toggleValue(
  value: string,
  values: string[],
  setter: (next: string[]) => void,
) {
  setter(
    values.includes(value)
      ? values.filter((item) => item !== value)
      : [...values, value],
  );
}

function FilterCheckbox({
  checked,
  label,
  count,
  onChange,
}: {
  checked: boolean;
  label: string;
  count?: number;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="group flex w-full items-center justify-between gap-3 py-1.5 text-left text-sm font-bold text-slate-700"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${checked ? "border-[#007f8f] bg-[#007f8f] text-white" : "border-slate-300 bg-white group-hover:border-[#007f8f]"}`}
        >
          {checked ? <Check size={13} strokeWidth={3} /> : null}
        </span>
        <span className="truncate">{label}</span>
      </span>
      {typeof count === "number" ? (
        <span className="shrink-0 text-xs font-black text-slate-400">
          {count}
        </span>
      ) : null}
    </button>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-slate-100 py-5 last:border-0">
      <h3 className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-950">
        {title}
      </h3>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

export default function PremiumCatalog({
  products,
}: {
  products: PremiumCatalogItem[];
}) {
  const prices = useMemo(
    () =>
      products
        .map((product) => product.minPriceHT)
        .filter((price): price is number => price !== null),
    [products],
  );
  const priceFloor = prices.length ? Math.floor(Math.min(...prices)) : 0;
  const priceCeiling = prices.length ? Math.ceil(Math.max(...prices)) : 0;

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("recommended");
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "grid";
    const savedView = localStorage.getItem("oyste-catalog-view");
    return savedView === "list" ? "list" : "grid";
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [families, setFamilies] = useState<string[]>([]);
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [capacities, setCapacities] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [availability, setAvailability] = useState<AvailabilityMode>("all");
  const [onlyDocuments, setOnlyDocuments] = useState(false);
  const [minPrice, setMinPrice] = useState(priceFloor);
  const [maxPrice, setMaxPrice] = useState(priceCeiling);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("oyste-favorites") || "[]");
    } catch {
      return [];
    }
  });
  const [compare, setCompare] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("oyste-compare") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("oyste-favorites", JSON.stringify(favorites));
  }, [favorites]);
  useEffect(() => {
    localStorage.setItem("oyste-compare", JSON.stringify(compare));
  }, [compare]);
  useEffect(() => {
    if (!showComparison) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowComparison(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [showComparison]);
  const filterOptions = useMemo(() => {
    const countBy = (key: keyof PremiumCatalogItem) =>
      uniqueSorted(products.map((product) => String(product[key] || ""))).map(
        (value) => ({
          value,
          count: products.filter(
            (product) => String(product[key] || "") === value,
          ).length,
        }),
      );
    return {
      families: countBy("family"),
      manufacturers: countBy("manufacturer"),
      capacities: countBy("capacityLabel").sort((a, b) => {
        if (a.value === "Non renseignée") return 1;
        if (b.value === "Non renseignée") return -1;
        const aValue =
          products.find((product) => product.capacityLabel === a.value)
            ?.capacityKg ?? Number.MAX_SAFE_INTEGER;
        const bValue =
          products.find((product) => product.capacityLabel === b.value)
            ?.capacityKg ?? Number.MAX_SAFE_INTEGER;
        return aValue - bValue;
      }),
      types: countBy("productType"),
    };
  }, [products]);

  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    const result = products.filter((product) => {
      if (
        term &&
        !normalize(
          `${product.name} ${product.code} ${product.family} ${product.description} ${product.manufacturer}`,
        ).includes(term)
      )
        return false;
      if (families.length && !families.includes(product.family)) return false;
      if (manufacturers.length && !manufacturers.includes(product.manufacturer))
        return false;
      if (capacities.length && !capacities.includes(product.capacityLabel))
        return false;
      if (types.length && !types.includes(product.productType)) return false;
      if (
        availability === "available" &&
        !(product.stock === null || product.stock > 0)
      )
        return false;
      if (availability === "order" && product.stock !== 0) return false;
      if (onlyDocuments && product.documentCount < 1) return false;
      if (
        product.minPriceHT !== null &&
        (product.minPriceHT < minPrice || product.minPriceHT > maxPrice)
      )
        return false;
      return true;
    });

    const originalOrder = new Map(
      products.map((product, index) => [product.id, index]),
    );

    return [...result].sort((a, b) => {
      if (sort === "recommended") {
        return (
          getRecommendationScore(b, originalOrder.get(b.id) ?? 0) -
          getRecommendationScore(a, originalOrder.get(a.id) ?? 0)
        );
      }
      if (sort === "availability") {
        const availabilityScore = (product: PremiumCatalogItem) =>
          product.stock === 0 ? 0 : 1;
        return (
          availabilityScore(b) - availabilityScore(a) ||
          a.name.localeCompare(b.name, "fr")
        );
      }
      if (sort === "price-asc")
        return (
          (a.minPriceHT ?? Number.MAX_SAFE_INTEGER) -
          (b.minPriceHT ?? Number.MAX_SAFE_INTEGER)
        );
      if (sort === "price-desc")
        return (b.minPriceHT ?? -1) - (a.minPriceHT ?? -1);
      if (sort === "capacity-asc")
        return (
          (a.capacityKg ?? Number.MAX_SAFE_INTEGER) -
          (b.capacityKg ?? Number.MAX_SAFE_INTEGER)
        );
      if (sort === "capacity-desc")
        return (b.capacityKg ?? -1) - (a.capacityKg ?? -1);
      if (sort === "documents")
        return (
          b.documentCount - a.documentCount || b.variantCount - a.variantCount
        );
      if (sort === "variants") return b.variantCount - a.variantCount;
      return a.name.localeCompare(b.name, "fr");
    });
  }, [
    products,
    query,
    sort,
    families,
    manufacturers,
    capacities,
    types,
    availability,
    onlyDocuments,
    minPrice,
    maxPrice,
  ]);

  const visible = filtered.slice(0, visibleCount);
  const comparedProducts = compare
    .map((id) => products.find((product) => product.id === id))
    .filter(Boolean) as PremiumCatalogItem[];
  const priceFiltered = priceFloor !== minPrice || priceCeiling !== maxPrice;
  const activeFilterCount =
    families.length +
    manufacturers.length +
    capacities.length +
    types.length +
    (availability !== "all" ? 1 : 0) +
    (onlyDocuments ? 1 : 0) +
    (priceFiltered ? 1 : 0);

  const comparisonRows = [
    {
      label: "Référence",
      icon: Package,
      value: (product: PremiumCatalogItem) => product.code,
    },
    {
      label: "Fabricant",
      value: (product: PremiumCatalogItem) => product.manufacturer,
    },
    {
      label: "Famille",
      value: (product: PremiumCatalogItem) => product.family,
    },
    {
      label: "Capacité / CMU",
      value: (product: PremiumCatalogItem) => product.capacityLabel,
    },
    {
      label: "Type",
      value: (product: PremiumCatalogItem) => product.productType,
    },
    {
      label: "Disponibilité",
      value: (product: PremiumCatalogItem) =>
        product.stock === 0 ? "Sur commande" : "Disponible",
    },
    {
      label: "Délai",
      value: (product: PremiumCatalogItem) => product.delay || "À confirmer",
    },
    {
      label: "Variantes",
      value: (product: PremiumCatalogItem) =>
        `${product.variantCount} variante${product.variantCount > 1 ? "s" : ""}`,
    },
    {
      label: "Documentation",
      icon: FileText,
      value: (product: PremiumCatalogItem) =>
        product.documentCount
          ? `${product.documentCount} document${product.documentCount > 1 ? "s" : ""}`
          : "Non disponible",
    },
    {
      label: "Expérience",
      value: (product: PremiumCatalogItem) =>
        product.experienceType === "CONFIGURABLE"
          ? "Configuration sur mesure"
          : "Produit standard",
    },
    {
      label: "Prix professionnel",
      value: (product: PremiumCatalogItem) => product.priceLabel,
    },
    {
      label: "Badges",
      value: (product: PremiumCatalogItem) =>
        product.badges.length ? product.badges.join(" · ") : "Catalogue OYSTE",
    },
  ];

  function applyChange(callback: () => void) {
    callback();
    setVisibleCount(PAGE_SIZE);
  }
  function changeView(nextView: ViewMode) {
    setView(nextView);
    localStorage.setItem("oyste-catalog-view", nextView);
  }
  function toggleFavorite(id: string) {
    setFavorites((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }
  function toggleCompare(id: string) {
    setCompare((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length >= 4
          ? current
          : [...current, id],
    );
  }
  function resetFilters() {
    setQuery("");
    setFamilies([]);
    setManufacturers([]);
    setCapacities([]);
    setTypes([]);
    setAvailability("all");
    setOnlyDocuments(false);
    setMinPrice(priceFloor);
    setMaxPrice(priceCeiling);
    setSort("recommended");
    setVisibleCount(PAGE_SIZE);
  }

  const filterPanel = (
    <div className="rounded-[2rem] border border-slate-200 bg-white px-5 shadow-sm lg:sticky lg:top-44">
      <div className="flex items-center justify-between border-b border-slate-100 py-5">
        <div>
          <p className="text-lg font-black text-slate-950">Filtres</p>
          <p className="mt-1 text-xs font-bold text-slate-500">
            Affinez votre sélection
          </p>
        </div>
        {activeFilterCount ? (
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-black text-orange-600 hover:text-orange-700"
          >
            Tout effacer
          </button>
        ) : null}
      </div>

      {filterOptions.families.length > 1 ? (
        <FilterSection title="Famille">
          {filterOptions.families.map((option) => (
            <FilterCheckbox
              key={option.value}
              checked={families.includes(option.value)}
              label={option.value}
              count={option.count}
              onChange={() =>
                applyChange(() =>
                  toggleValue(option.value, families, setFamilies),
                )
              }
            />
          ))}
        </FilterSection>
      ) : null}
      {filterOptions.manufacturers.length > 1 ? (
        <FilterSection title="Fabricant">
          {filterOptions.manufacturers.map((option) => (
            <FilterCheckbox
              key={option.value}
              checked={manufacturers.includes(option.value)}
              label={option.value}
              count={option.count}
              onChange={() =>
                applyChange(() =>
                  toggleValue(option.value, manufacturers, setManufacturers),
                )
              }
            />
          ))}
        </FilterSection>
      ) : null}

      {priceCeiling > priceFloor ? (
        <FilterSection title="Prix HT">
          <div className="grid grid-cols-2 gap-3">
            <label className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="block text-[10px] font-black uppercase text-slate-400">
                Minimum
              </span>
              <input
                type="number"
                min={priceFloor}
                max={maxPrice}
                value={minPrice}
                onChange={(event) =>
                  applyChange(() =>
                    setMinPrice(Math.min(Number(event.target.value), maxPrice)),
                  )
                }
                className="mt-1 w-full bg-transparent text-sm font-black outline-none"
              />
            </label>
            <label className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="block text-[10px] font-black uppercase text-slate-400">
                Maximum
              </span>
              <input
                type="number"
                min={minPrice}
                max={priceCeiling}
                value={maxPrice}
                onChange={(event) =>
                  applyChange(() =>
                    setMaxPrice(Math.max(Number(event.target.value), minPrice)),
                  )
                }
                className="mt-1 w-full bg-transparent text-sm font-black outline-none"
              />
            </label>
          </div>
          <input
            type="range"
            min={priceFloor}
            max={priceCeiling}
            value={maxPrice}
            onChange={(event) =>
              applyChange(() =>
                setMaxPrice(Math.max(Number(event.target.value), minPrice)),
              )
            }
            className="mt-4 w-full accent-[#007f8f]"
          />
        </FilterSection>
      ) : null}

      <FilterSection title="Disponibilité">
        <FilterCheckbox
          checked={availability === "available"}
          label="Disponible"
          count={
            products.filter(
              (product) => product.stock === null || product.stock > 0,
            ).length
          }
          onChange={() =>
            applyChange(() =>
              setAvailability(
                availability === "available" ? "all" : "available",
              ),
            )
          }
        />
        <FilterCheckbox
          checked={availability === "order"}
          label="Sur commande"
          count={products.filter((product) => product.stock === 0).length}
          onChange={() =>
            applyChange(() =>
              setAvailability(availability === "order" ? "all" : "order"),
            )
          }
        />
      </FilterSection>

      {filterOptions.capacities.length > 1 ? (
        <FilterSection title="Capacité / CMU">
          {filterOptions.capacities.slice(0, 12).map((option) => (
            <FilterCheckbox
              key={option.value}
              checked={capacities.includes(option.value)}
              label={option.value}
              count={option.count}
              onChange={() =>
                applyChange(() =>
                  toggleValue(option.value, capacities, setCapacities),
                )
              }
            />
          ))}
        </FilterSection>
      ) : null}
      {filterOptions.types.length > 1 ? (
        <FilterSection title="Type">
          {filterOptions.types.map((option) => (
            <FilterCheckbox
              key={option.value}
              checked={types.includes(option.value)}
              label={option.value}
              count={option.count}
              onChange={() =>
                applyChange(() => toggleValue(option.value, types, setTypes))
              }
            />
          ))}
        </FilterSection>
      ) : null}
      <FilterSection title="Documentation">
        <FilterCheckbox
          checked={onlyDocuments}
          label="Documentation disponible"
          count={products.filter((product) => product.documentCount > 0).length}
          onChange={() =>
            applyChange(() => setOnlyDocuments((value) => !value))
          }
        />
      </FilterSection>
    </div>
  );

  return (
    <div>
      <div className="sticky top-20 z-30 rounded-[2rem] border border-slate-200 bg-white/95 p-4 shadow-xl shadow-slate-950/5 backdrop-blur-xl md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <label className="relative flex-1">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              size={20}
            />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              placeholder="Rechercher un produit, une référence, un fabricant…"
              className="h-13 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-11 text-sm font-bold text-slate-950 outline-none transition focus:border-[#007f8f] focus:bg-white focus:ring-4 focus:ring-[#007f8f]/10"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-950"
                aria-label="Effacer la recherche"
              >
                <X size={18} />
              </button>
            ) : null}
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilters((value) => !value)}
              className={`inline-flex h-12 items-center gap-2 rounded-2xl border px-4 text-sm font-black transition lg:hidden ${showFilters || activeFilterCount ? "border-[#007f8f] bg-[#007f8f]/10 text-[#005466]" : "border-slate-200 bg-white text-slate-700"}`}
            >
              <SlidersHorizontal size={18} /> Filtres{" "}
              {activeFilterCount ? (
                <span className="rounded-full bg-[#007f8f] px-2 py-0.5 text-[11px] text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
            <label className="relative">
              <select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value as SortMode);
                  setVisibleCount(PAGE_SIZE);
                }}
                className="h-12 appearance-none rounded-2xl border border-slate-200 bg-white pl-4 pr-10 text-sm font-black text-slate-700 outline-none focus:border-[#007f8f]"
              >
                <option value="recommended">Recommandés</option>
                <option value="availability">Disponibilité</option>
                <option value="price-asc">Prix croissant</option>
                <option value="price-desc">Prix décroissant</option>
                <option value="capacity-asc">CMU croissante</option>
                <option value="capacity-desc">CMU décroissante</option>
                <option value="documents">Les plus documentés</option>
                <option value="variants">Plus de variantes</option>
                <option value="name">Nom A–Z</option>
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                size={17}
              />
            </label>
            <div className="flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => changeView("grid")}
                className={`rounded-xl p-2.5 ${view === "grid" ? "bg-white text-[#007f8f] shadow-sm" : "text-slate-400"}`}
                aria-label="Vue grille"
              >
                <Grid2X2 size={19} />
              </button>
              <button
                type="button"
                onClick={() => changeView("list")}
                className={`rounded-xl p-2.5 ${view === "list" ? "bg-white text-[#007f8f] shadow-sm" : "text-slate-400"}`}
                aria-label="Vue liste"
              >
                <LayoutList size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {showFilters ? (
        <div className="mt-4 lg:hidden">
          {filterPanel}
          <button
            type="button"
            onClick={() => setShowFilters(false)}
            className="mt-3 w-full rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-black text-white"
          >
            Voir {filtered.length} produit{filtered.length > 1 ? "s" : ""}
          </button>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-slate-600">
            <span className="text-lg font-black text-slate-950">
              {filtered.length}
            </span>{" "}
            produit{filtered.length > 1 ? "s" : ""} trouvé
            {filtered.length > 1 ? "s" : ""}
          </p>
          <p className="mt-1 text-xs font-bold text-slate-400">
            Tri actuel :{" "}
            <span className="text-[#007f8f]">{SORT_LABELS[sort]}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeFilterCount ? (
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-black text-orange-700"
            >
              Effacer {activeFilterCount} filtre
              {activeFilterCount > 1 ? "s" : ""}
            </button>
          ) : null}
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            Catalogue professionnel OYSTE
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-7 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[285px_minmax(0,1fr)]">
        <aside className="hidden lg:block">{filterPanel}</aside>
        <div>
          {visible.length ? (
            view === "grid" ? (
              <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
                {visible.map((product) => {
                  const favorite = favorites.includes(product.id);
                  const compared = compare.includes(product.id);
                  return (
                    <article
                      key={product.id}
                      className="group relative flex h-full flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-orange-400 hover:shadow-xl"
                    >
                      <div className="relative">
                        <Link href={product.href} className="block">
                          <ProductMediaFrame
                            src={product.imageUrl}
                            alt={product.name}
                            label={product.badge}
                            documentCount={product.documentCount}
                            variant="card"
                            interactive
                          />
                        </Link>
                        <div className="absolute right-4 top-4 z-10 flex gap-2">
                          <button
                            type="button"
                            onClick={() => toggleFavorite(product.id)}
                            className={`grid h-10 w-10 place-items-center rounded-full border bg-white/95 shadow-sm transition ${favorite ? "border-orange-300 text-orange-600" : "border-white text-slate-500 hover:text-orange-600"}`}
                            aria-label="Ajouter aux favoris"
                          >
                            <Heart
                              size={18}
                              fill={favorite ? "currentColor" : "none"}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleCompare(product.id)}
                            className={`grid h-10 w-10 place-items-center rounded-full border bg-white/95 shadow-sm transition ${compared ? "border-[#007f8f] text-[#007f8f]" : "border-white text-slate-500 hover:text-[#007f8f]"}`}
                            aria-label="Comparer ce produit"
                          >
                            <GitCompareArrows size={18} />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col p-6">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">
                              {product.family}
                            </p>
                            <p className="mt-2 text-xs font-bold text-slate-400">
                              Réf. {product.code}
                            </p>
                          </div>
                          <span
                            className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${product.stock === 0 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
                          >
                            {product.stock === 0
                              ? "Sur commande"
                              : "Disponible"}
                          </span>
                        </div>
                        <Link href={product.href} className="mt-4 block">
                          <h3 className="line-clamp-2 text-xl font-black leading-tight text-slate-950 transition group-hover:text-[#007f8f]">
                            {product.name}
                          </h3>
                        </Link>
                        <p className="mt-3 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-slate-600">
                          {product.description}
                        </p>
                        {product.badges.length ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {product.badges.slice(1, 3).map((badge) => (
                              <ProductBadge key={badge} label={badge} />
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {product.manufacturer !== "Non renseigné" ? (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">
                              {product.manufacturer}
                            </span>
                          ) : null}
                          {product.capacityKg !== null ? (
                            <span className="rounded-full bg-[#007f8f]/10 px-2.5 py-1 text-[10px] font-black text-[#005466]">
                              CMU {product.capacityLabel}
                            </span>
                          ) : null}
                          <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-black text-orange-700">
                            {product.productType}
                          </span>
                          {product.variantCount > 1 ? (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">
                              {product.variantCount} variantes
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-auto pt-5">
                          <div className="flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-5">
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                                Prix professionnel
                              </p>
                              <p className="mt-1 text-xl font-black text-slate-950">
                                {product.priceLabel}
                              </p>
                            </div>
                            <Link
                              href={product.href}
                              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-[#007f8f]"
                            >
                              Voir la fiche <ArrowRight size={17} />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="grid gap-3">
                {visible.map((product) => {
                  const favorite = favorites.includes(product.id);
                  const compared = compare.includes(product.id);
                  return (
                    <article
                      key={product.id}
                      className="group relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition duration-300 hover:border-[#007f8f]/40 hover:shadow-lg"
                    >
                      <div className="grid md:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_220px]">
                        <div className="relative border-b border-slate-100 md:border-b-0 md:border-r">
                          <Link href={product.href} className="block h-full">
                            <ProductMediaFrame
                              src={product.imageUrl}
                              alt={product.name}
                              label={product.badge}
                              documentCount={product.documentCount}
                              variant="card"
                              interactive
                            />
                          </Link>
                        </div>
                        <div className="min-w-0 p-5 md:p-6">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-600">
                              {product.family}
                            </p>
                            <span className="text-xs font-bold text-slate-300">
                              •
                            </span>
                            <p className="text-xs font-bold text-slate-400">
                              Réf. {product.code}
                            </p>
                          </div>
                          <Link href={product.href} className="mt-2 block">
                            <h3 className="line-clamp-2 text-lg font-black leading-tight text-slate-950 transition group-hover:text-[#007f8f] md:text-xl">
                              {product.name}
                            </h3>
                          </Link>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                            {product.description}
                          </p>
                          <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
                            <div>
                              <p className="font-bold text-slate-400">
                                Fabricant
                              </p>
                              <p className="mt-1 font-black text-slate-700">
                                {product.manufacturer}
                              </p>
                            </div>
                            <div>
                              <p className="font-bold text-slate-400">
                                Capacité / CMU
                              </p>
                              <p className="mt-1 font-black text-slate-700">
                                {product.capacityLabel}
                              </p>
                            </div>
                            <div>
                              <p className="font-bold text-slate-400">Type</p>
                              <p className="mt-1 font-black text-slate-700">
                                {product.productType}
                              </p>
                            </div>
                            <div>
                              <p className="font-bold text-slate-400">
                                Variantes
                              </p>
                              <p className="mt-1 font-black text-slate-700">
                                {product.variantCount}
                              </p>
                            </div>
                          </div>
                          {product.badges.length ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {product.badges.slice(1, 3).map((badge) => (
                                <ProductBadge key={badge} label={badge} />
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-col justify-between gap-5 border-t border-slate-100 bg-slate-50/70 p-5 md:col-span-2 md:flex-row md:items-center xl:col-span-1 xl:border-l xl:border-t-0 xl:p-6">
                          <div>
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${product.stock === 0 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
                            >
                              {product.stock === 0
                                ? "Sur commande"
                                : "Disponible"}
                            </span>
                            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                              Prix professionnel
                            </p>
                            <p className="mt-1 text-lg font-black text-slate-950">
                              {product.priceLabel}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 xl:flex-col xl:items-stretch">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => toggleFavorite(product.id)}
                                className={`grid h-11 w-11 place-items-center rounded-xl border bg-white shadow-sm transition ${favorite ? "border-orange-300 text-orange-600" : "border-slate-200 text-slate-500 hover:text-orange-600"}`}
                                aria-label="Ajouter aux favoris"
                              >
                                <Heart
                                  size={18}
                                  fill={favorite ? "currentColor" : "none"}
                                />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleCompare(product.id)}
                                className={`grid h-11 w-11 place-items-center rounded-xl border bg-white shadow-sm transition ${compared ? "border-[#007f8f] text-[#007f8f]" : "border-slate-200 text-slate-500 hover:text-[#007f8f]"}`}
                                aria-label="Comparer ce produit"
                              >
                                <GitCompareArrows size={18} />
                              </button>
                            </div>
                            <Link
                              href={product.href}
                              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-[#007f8f]"
                            >
                              Voir la fiche <ArrowRight size={17} />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )
          ) : (
            <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-12 text-center">
              <Search className="mx-auto text-slate-300" size={42} />
              <h3 className="mt-5 text-xl font-black text-slate-950">
                Aucun produit ne correspond
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Modifiez votre recherche ou réinitialisez les filtres.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
              >
                Réinitialiser
              </button>
            </div>
          )}
          {visibleCount < filtered.length ? (
            <div className="mt-10 text-center">
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                className="rounded-2xl border border-slate-200 bg-white px-7 py-4 text-sm font-black text-slate-800 shadow-sm transition hover:border-[#007f8f] hover:text-[#007f8f]"
              >
                Afficher plus de produits ({filtered.length - visibleCount}{" "}
                restants)
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {comparedProducts.length ? (
        <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-6xl rounded-[1.75rem] border border-slate-700 bg-slate-950 p-4 text-white shadow-2xl md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10">
                <GitCompareArrows size={21} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black">Comparateur OYSTE</p>
                <p className="truncate text-xs text-slate-300">
                  {comparedProducts.length === 1
                    ? "Ajoutez au moins un deuxième produit"
                    : `${comparedProducts.length} produits prêts à comparer`}
                </p>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto lg:justify-end">
              {comparedProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex max-w-[190px] shrink-0 items-center gap-2 rounded-xl bg-white/10 px-3 py-2"
                >
                  <span className="truncate text-xs font-bold">
                    {product.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleCompare(product.id)}
                    className="shrink-0 rounded-full p-0.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
                    aria-label={`Retirer ${product.name} du comparateur`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-black">
                {comparedProducts.length}/4
              </span>
              <button
                type="button"
                onClick={() => setCompare([])}
                className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-black transition hover:bg-white/10"
              >
                Vider
              </button>
              <button
                type="button"
                onClick={() => setShowComparison(true)}
                disabled={comparedProducts.length < 2}
                className="rounded-xl bg-orange-500 px-5 py-2.5 text-xs font-black text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Comparer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showComparison && comparedProducts.length >= 2 ? (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Comparateur de produits OYSTE"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowComparison(false);
          }}
        >
          <div className="absolute inset-0 flex flex-col bg-slate-50 md:inset-4 md:rounded-[2rem] md:border md:border-white/20 md:shadow-2xl xl:inset-8">
            <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 md:rounded-t-[2rem] md:px-7">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#007f8f]/10 text-[#005466]">
                  <GitCompareArrows size={22} />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-black text-slate-950">
                    Comparateur Premium
                  </p>
                  <p className="text-xs font-bold text-slate-500">
                    Les différences sont automatiquement mises en évidence
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowComparison(false)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-950"
                aria-label="Fermer le comparateur"
              >
                <X size={21} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-auto p-4 md:p-6">
              <div
                className="min-w-[760px] overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm"
                style={{
                  display: "grid",
                  gridTemplateColumns: `190px repeat(${comparedProducts.length}, minmax(220px, 1fr))`,
                }}
              >
                <div className="sticky left-0 z-30 border-b border-r border-slate-200 bg-slate-950 p-5 text-white">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    Comparaison
                  </p>
                  <p className="mt-2 text-lg font-black">
                    {comparedProducts.length} produits
                  </p>
                </div>

                {comparedProducts.map((product) => (
                  <div
                    key={`header-${product.id}`}
                    className="relative border-b border-r border-slate-200 bg-white p-4 last:border-r-0"
                  >
                    <button
                      type="button"
                      onClick={() => toggleCompare(product.id)}
                      className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:text-rose-600"
                      aria-label={`Retirer ${product.name}`}
                    >
                      <X size={15} />
                    </button>
                    <Link href={product.href} target="_blank" className="block">
                      <div className="mx-auto h-36 max-w-[180px] overflow-hidden rounded-xl bg-slate-50">
                        <ProductMediaFrame
                          src={product.imageUrl}
                          alt={product.name}
                          label={product.badge}
                          documentCount={product.documentCount}
                          variant="card"
                        />
                      </div>
                      <p className="mt-4 line-clamp-2 text-sm font-black leading-5 text-slate-950 hover:text-[#007f8f]">
                        {product.name}
                      </p>
                    </Link>
                  </div>
                ))}

                {comparisonRows.flatMap((row) => {
                  const values = comparedProducts.map(row.value);
                  const differs = new Set(values.map(normalize)).size > 1;
                  const RowIcon = row.icon;
                  return [
                    <div
                      key={`${row.label}-label`}
                      className="sticky left-0 z-20 flex items-center gap-2 border-b border-r border-slate-200 bg-slate-50 p-4 text-xs font-black uppercase tracking-[0.1em] text-slate-600"
                    >
                      {RowIcon ? <RowIcon size={15} /> : null}
                      {row.label}
                    </div>,
                    ...comparedProducts.map((product, index) => (
                      <div
                        key={`${row.label}-${product.id}`}
                        className={`border-b border-r border-slate-200 p-4 text-sm font-bold leading-6 last:border-r-0 ${
                          differs
                            ? "bg-orange-50/70 text-slate-950"
                            : "bg-white text-slate-700"
                        }`}
                      >
                        {differs ? (
                          <span className="mb-2 inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-orange-700">
                            Différence
                          </span>
                        ) : null}
                        <p>{values[index]}</p>
                      </div>
                    )),
                  ];
                })}

                <div className="sticky left-0 z-20 border-r border-slate-200 bg-slate-950 p-4 text-xs font-black uppercase tracking-[0.1em] text-white">
                  Accès produit
                </div>
                {comparedProducts.map((product) => (
                  <div
                    key={`action-${product.id}`}
                    className="border-r border-slate-200 bg-white p-4 last:border-r-0"
                  >
                    <Link
                      href={product.href}
                      target="_blank"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-[#007f8f]"
                    >
                      Voir la fiche <ExternalLink size={16} />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
