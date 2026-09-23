"use client";

import { useMemo, useState } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import ProductCard from "./ProductCard";
import { formatCategoryLabel, formatPriceRange, getCustomerProductDescription, getProductAvailableDocumentCount, getProductMediaImages, isPotenceProduct, type CatalogueProduct, type CatalogueVariant } from "@/lib/catalogue/repository";

type SortMode = "default" | "price-asc" | "price-desc";
type FilterKey = "capacity" | "power" | "trolley" | "reach" | "height";

function optionValue(variant: CatalogueVariant, pattern: RegExp) {
  return Object.entries(variant.options || {}).find(([label]) => pattern.test(label))?.[1] || "";
}

function productValues(product: CatalogueProduct, key: FilterKey) {
  const variants = product.variants || [];
  const values = variants.map((variant) => {
    if (key === "capacity") return optionValue(variant, /^(cmu|capacit)/i);
    if (key === "power") return optionValue(variant, /tension|alimentation/i);
    if (key === "reach") return optionValue(variant, /portée|portee/i);
    if (key === "height") return optionValue(variant, /hauteur|hsf/i);
    return "";
  });
  if (key === "trolley") {
    const source = `${product.code} ${product.name}`;
    if (/chariot.*(électri|electri|motoris)|^(ER2M|EQM|CET)/i.test(source)) values.push("Chariot électrique / motorisé");
    else if (/chariot|^EQSP/i.test(source)) values.push("Chariot manuel");
    else if (/palan/i.test(source)) values.push("Sans chariot");
  }
  return [...new Set(values.filter(Boolean))];
}

function capacityKg(value: string) {
  const match = value.replace(/\s/g, "").match(/(\d+(?:[.,]\d+)?)\s*(kg|t)?/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const amount = Number(match[1].replace(",", "."));
  return /t/i.test(match[2] || "") ? amount * 1000 : amount;
}

export default function CatalogProductGrid({ products }: { products: CatalogueProduct[] }) {
  const [filters, setFilters] = useState<Partial<Record<FilterKey, string>>>({});
  const [sort, setSort] = useState<SortMode>("default");
  const [mobileOpen, setMobileOpen] = useState(false);
  const isLifting = products.some((product) => /palan/i.test(`${product.name} ${product.categoryPath}`));
  const isStructure = products.some((product) => /potence|portique/i.test(`${product.name} ${product.categoryPath}`));
  const keys: FilterKey[] = isLifting ? ["capacity", "power", "trolley"] : isStructure ? ["capacity", "reach", "height"] : ["capacity"];
  const matches = (product: CatalogueProduct, ignored?: FilterKey) => keys.every((key) => key === ignored || !filters[key] || productValues(product, key).includes(filters[key]!));
  const options = Object.fromEntries(keys.map((key) => {
    const unique = [...new Set(products.filter((product) => matches(product, key)).flatMap((product) => productValues(product, key)))];
    unique.sort(key === "capacity" ? (a, b) => capacityKg(a) - capacityKg(b) : (a, b) => a.localeCompare(b, "fr"));
    return [key, unique];
  })) as Record<FilterKey, string[]>;
  const filtered = useMemo(() => {
    const result = products.filter((product) => matches(product));
    return [...result].sort((a, b) => {
      const aPrice = a.minPriceHT ?? a.priceHT;
      const bPrice = b.minPriceHT ?? b.priceHT;
      if (sort === "price-asc") return (aPrice ?? Number.MAX_SAFE_INTEGER) - (bPrice ?? Number.MAX_SAFE_INTEGER);
      if (sort === "price-desc") return (bPrice ?? -1) - (aPrice ?? -1);
      return 0;
    });
  // Les dépendances primitives sont regroupées dans filters pour garder le calcul local au composant.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, filters, sort]);
  const labels: Record<FilterKey, string> = { capacity: "CMU", power: "Alimentation", trolley: "Type de chariot", reach: "Portée", height: "Hauteur" };
  const controls = <>
    {keys.map((key) => options[key].length > 1 ? <label key={key} className="min-w-[150px] flex-1"><span className="sr-only">{labels[key]}</span><select value={filters[key] || ""} onChange={(event) => setFilters((current) => ({ ...current, [key]: event.target.value || undefined }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-[#007f8f]"><option value="">{labels[key]} · Toutes</option>{options[key].map((value) => <option key={value} value={value}>{value}</option>)}</select></label> : null)}
    <label className="min-w-[155px] flex-1"><span className="sr-only">Trier par</span><select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-[#007f8f]"><option value="default">Trier · Pertinence</option><option value="price-asc">Prix croissant</option><option value="price-desc">Prix décroissant</option></select></label>
    {Object.values(filters).some(Boolean) ? <button type="button" onClick={() => setFilters({})} className="inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-black text-orange-700"><RotateCcw size={16} /> Réinitialiser</button> : null}
  </>;
  return <div><div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between gap-3 md:hidden"><button type="button" onClick={() => setMobileOpen((value) => !value)} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black"><SlidersHorizontal size={17} /> Filtrer</button><span className="text-sm font-bold text-slate-600">{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</span></div><div className={`${mobileOpen ? "mt-3 flex" : "hidden"} flex-col gap-2 md:flex md:flex-row md:flex-wrap md:items-center`}>{controls}<span className="ml-auto whitespace-nowrap text-sm font-bold text-slate-600">{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</span></div></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{filtered.map((product) => { const isPotence = isPotenceProduct(product); return <ProductCard key={product.id} code={product.code} name={product.name} family={formatCategoryLabel(product.categoryPath)} price={isPotence ? "Configuration sur mesure" : formatPriceRange(product)} description={getCustomerProductDescription(product)} href={product.href} cta="Voir la fiche" imageRef={product.imageRef || product.code} imageUrl={getProductMediaImages(product)[0]} badge={isPotence ? "Potence configurable" : product.code} documentCount={getProductAvailableDocumentCount(product)} />; })}</div></div>;
}
