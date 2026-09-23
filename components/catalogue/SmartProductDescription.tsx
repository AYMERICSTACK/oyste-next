import { CheckCircle2 } from "lucide-react";
import type { CatalogueProduct } from "@/lib/catalogue/repository";
import { buildSmartDescription } from "@/lib/catalogue/smart-description";

function inlineMarkup(value: string) {
  const parts = value.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).filter(Boolean);
  return parts.map((part, index) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) return <strong key={`${part}-${index}`} className="font-black text-slate-950">{bold[1]}</strong>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return <a key={`${part}-${index}`} href={link[2]} target="_blank" rel="noreferrer" className="font-black text-[#007f8f] underline underline-offset-4">{link[1]}</a>;
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function renderBlock(block: string, index: number) {
  const title = block.match(/^(?:•\s*)?\*\*([\s\S]+)\*\*$/);
  if (title) return <h3 key={index} className="mt-2 text-lg font-black text-slate-950">{inlineMarkup(title[1])}</h3>;
  if (/^(?:•|-)\s+/.test(block)) return <div key={index} className="flex items-start gap-3"><CheckCircle2 size={17} className="mt-1 shrink-0 text-[#007f8f]" /><p>{inlineMarkup(block.replace(/^(?:•|-)\s+/, ""))}</p></div>;
  return <p key={index}>{inlineMarkup(block)}</p>;
}

export default function SmartProductDescription({ product }: { product: CatalogueProduct }) {
  const supplierText = product.detailedDescription?.trim();
  const fallback = buildSmartDescription(product).introduction;
  const structuredSupplierText = supplierText?.replace(/\r/g, "").replace(
    /\s+(?=(?:Type|Capacité|CMU|Groupe\s+F\.?E\.?M\.?|Hauteur de levage|Hauteur sous fer|Hauteur perdue|Largeur de fer|Poids|Puissance|Tension|Vitesse|Longueur|Nombre de brins?|Protection|Fin de course|Garantie|Déplacement|Direction libre|Limiteur|Bac à chaîne|Chaîne de levage)\s*:)/gi,
    "\n",
  );
  const blocks = structuredSupplierText
    ? structuredSupplierText.split(/\n+|(?<=[.;])\s+(?=[A-ZÀ-ÖØ-Ý])/).map((value) => value.trim()).filter(Boolean)
    : fallback;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-2xl font-black text-slate-950">Description du produit</h2>
      <div className="mt-5 grid max-w-5xl gap-3 text-sm font-medium leading-7 text-slate-600">
        {blocks.map(renderBlock)}
      </div>
    </section>
  );
}
