import { ArrowRight } from "lucide-react";
import {
  formatCategoryLabel,
  formatPriceRange,
  type CatalogueProduct,
} from "@/lib/catalogue/repository";
import { getProductImageUrl } from "@/lib/product-images";

function capacityLabel(product: CatalogueProduct) {
  const feature = product.features?.find((item) => /cmu|capacit|charge/i.test(item.label));
  if (feature?.value) return feature.value;
  const source = `${product.name} ${product.description}`;
  return source.match(/\d[\d\s]*(?:[.,]\d+)?\s*(?:kg|t(?:onne)?s?)\b/i)?.[0] ?? null;
}

export default function CrossSellingSection({ products }: { products: CatalogueProduct[] }) {
  if (!products.length) return null;

  return (
    <section id="produits-associes" className="mt-9 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">Association technique renseignée</p>
        <h2 className="mt-1 text-2xl font-black text-slate-950">Produits compatibles</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((item) => {
          const capacity = capacityLabel(item);
          return (
            <a key={item.id} href={item.href} className="group grid grid-cols-[88px_1fr] gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-orange-400 hover:shadow-md">
              <div className="flex h-[82px] items-center justify-center overflow-hidden rounded-lg bg-slate-50">
                <img src={getProductImageUrl(item.imageRef, item.code, item.parentCode)} alt="" className="h-full w-full object-contain p-2" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-orange-600">{formatCategoryLabel(item.categoryPath)}</p>
                <h3 className="mt-1 line-clamp-2 text-sm font-black leading-5 text-slate-950">{item.name}</h3>
                <p className="mt-1 text-[11px] font-bold text-slate-500">Réf. {item.code}{capacity ? ` · ${capacity}` : ""}</p>
                <p className="mt-2 flex items-center gap-1 text-xs font-black text-[#007f8f]">{formatPriceRange(item)} <ArrowRight size={13} className="transition group-hover:translate-x-1" /></p>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
