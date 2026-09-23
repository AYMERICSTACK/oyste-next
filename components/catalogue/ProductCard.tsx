import { ArrowRight } from "lucide-react";
import { getProductImageUrl } from "@/lib/product-images";
import { getImportedProductDocuments } from "@/lib/catalogue/media";
import ProductMediaFrame from "./ProductMediaFrame";

export default function ProductCard({
  code,
  name,
  family,
  price,
  description,
  href,
  cta,
  imageRef,
  imageUrl,
  badge,
  documentCount,
}: {
  code: string;
  name: string;
  family: string;
  price: string;
  description: string;
  href: string;
  cta: string;
  imageRef?: string;
  imageUrl?: string;
  badge?: string;
  documentCount?: number;
}) {
  const resolvedImageUrl = imageUrl || getProductImageUrl(imageRef, code);
  const availableDocumentCount = documentCount ?? getImportedProductDocuments(imageRef, code).length;

  return (
    <a
      href={href}
      className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-orange-500 hover:shadow-lg"
    >
      <ProductMediaFrame
        src={resolvedImageUrl}
        alt={name}
        label={badge ?? code}
        documentCount={availableDocumentCount}
        variant="card"
        interactive
      />

      <div className="p-4">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-600">
          {family}
        </p>

        <h3 className="mt-2 line-clamp-2 text-base font-black leading-snug text-slate-950">{name}</h3>
        <p className="mt-1 text-xs font-bold text-slate-500">Réf. {code}</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-base font-black text-slate-950">{price}</p>
          {availableDocumentCount > 0 ? (
            <span className="rounded-full bg-[#007f8f]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#005466]">
              Fiche technique
            </span>
          ) : null}
        </div>

        <p className="mt-3 flex items-center gap-2 text-xs font-black text-[#007f8f]">
          {cta} <ArrowRight size={18} className="transition group-hover:translate-x-1" />
        </p>
      </div>
    </a>
  );
}
