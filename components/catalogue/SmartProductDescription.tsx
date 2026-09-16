import { CheckCircle2, FileText, Lightbulb, Settings2, Sparkles } from "lucide-react";
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

function renderSupplierBlock(block: string, index: number) {
  const title = block.match(/^(?:•\s*)?\*\*([\s\S]+)\*\*$/);
  if (title) {
    return (
      <h3 key={`${block}-${index}`} className="mt-2 text-xl font-black leading-7 text-slate-950">
        {inlineMarkup(title[1])}
      </h3>
    );
  }

  if (/^(?:•|-)\s+/.test(block)) {
    return (
      <div key={`${block}-${index}`} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
        <CheckCircle2 size={18} className="mt-1 shrink-0 text-[#007f8f]" />
        <p>{inlineMarkup(block.replace(/^(?:•|-)\s+/, ""))}</p>
      </div>
    );
  }

  return <p key={`${block}-${index}`}>{inlineMarkup(block)}</p>;
}

function StructuredSupplierDescription({ value }: { value: string }) {
  const blocks = value
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const previewBlocks = blocks.slice(0, 3);
  const remainingBlocks = blocks.slice(3);

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm lg:p-7">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#007f8f]/10 text-[#007f8f]">
          <Sparkles size={21} />
        </span>
        <div>
          <p className="text-sm font-black uppercase tracking-[0.25em] text-slate-500">Présentation détaillée</p>
          <h2 className="text-2xl font-black text-slate-950">Description du produit</h2>
        </div>
      </div>

      <div className="mt-6 grid gap-4 text-base font-medium leading-7 text-slate-600">
        {previewBlocks.map(renderSupplierBlock)}
      </div>

      {remainingBlocks.length > 0 ? (
        <details className="group mt-5">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-black text-slate-900 transition hover:border-[#007f8f]/30 hover:bg-[#007f8f]/5">
            <span>Voir la description complète</span>
            <span className="text-xl text-[#007f8f] transition group-open:rotate-45">+</span>
          </summary>
          <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 text-base font-medium leading-7 text-slate-600">
            {remainingBlocks.map((block, index) => renderSupplierBlock(block, index + previewBlocks.length))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

export default function SmartProductDescription({ product }: { product: CatalogueProduct }) {
  const smartDescription = buildSmartDescription(product);
  const hasSupplierDescription = Boolean(product.detailedDescription?.trim());

  return (
    <div className="grid gap-6">
      {hasSupplierDescription ? (
        <StructuredSupplierDescription value={product.detailedDescription} />
      ) : (
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#007f8f]/10 text-[#007f8f]">
            <Sparkles size={21} />
          </span>
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-slate-500">Présentation</p>
            <h2 className="text-2xl font-black text-slate-950">Une solution pensée pour votre usage</h2>
          </div>
        </div>

        <div className="mt-6 grid gap-4 text-base leading-8 text-slate-600">
          {smartDescription.introduction.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>
      )}

      {smartDescription.technicalSpecs.length > 0 ? (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
              <Settings2 size={21} />
            </span>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-slate-500">
                Caractéristiques techniques
              </p>
              <h2 className="text-2xl font-black text-slate-950">Les données essentielles</h2>
            </div>
          </div>

          <div className="mt-6 grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {smartDescription.technicalSpecs.slice(0, 6).map((spec) => (
              <div key={`${spec.label}-${spec.value}`} className="h-fit rounded-2xl bg-slate-50 px-4 py-4">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{spec.label}</p>
                <p className="mt-1.5 text-sm font-black leading-5 text-slate-950">{spec.value}</p>
              </div>
            ))}
          </div>

          {smartDescription.technicalSpecs.length > 6 ? (
            <details className="group mt-4">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-2xl border border-slate-200 px-5 py-3.5 text-sm font-black text-slate-800 transition hover:border-[#007f8f]/30 hover:bg-[#007f8f]/5">
                <span>Voir toutes les caractéristiques ({smartDescription.technicalSpecs.length})</span>
                <span className="text-xl text-[#007f8f] transition group-open:rotate-45">+</span>
              </summary>
              <div className="mt-4 grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {smartDescription.technicalSpecs.slice(6).map((spec) => (
                  <div key={`${spec.label}-${spec.value}`} className="h-fit rounded-2xl bg-slate-50 px-4 py-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{spec.label}</p>
                    <p className="mt-1.5 text-sm font-black leading-5 text-slate-950">{spec.value}</p>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </section>
      ) : null}

      {smartDescription.strengths.length > 0 ? (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-slate-500">Points forts</p>
          <div className="mt-5 grid items-start gap-3 sm:grid-cols-2">
            {smartDescription.strengths.slice(0, 4).map((strength) => (
              <div key={strength} className="h-fit flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-700">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#007f8f]" />
                <span>{strength}</span>
              </div>
            ))}
          </div>
          {smartDescription.strengths.length > 4 ? (
            <details className="group mt-4">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-800">
                <span>Voir tous les points forts</span>
                <span className="text-xl text-[#007f8f] transition group-open:rotate-45">+</span>
              </summary>
              <div className="mt-4 grid items-start gap-3 sm:grid-cols-2">
                {smartDescription.strengths.slice(4).map((strength) => (
                  <div key={strength} className="h-fit flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-700">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#007f8f]" />
                    <span>{strength}</span>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </section>
      ) : null}

      {smartDescription.advice.length > 0 ? (
        <section className="rounded-[2rem] border border-[#007f8f]/20 bg-[#007f8f]/5 p-8">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#007f8f] shadow-sm">
              <Lightbulb size={21} />
            </span>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-[#005466]">Conseil OYSTE</p>
              <div className="mt-3 grid gap-2 text-sm font-bold leading-7 text-slate-700">
                {smartDescription.advice.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {smartDescription.documents.length > 0 ? (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <FileText size={21} />
            </span>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-slate-500">Documents</p>
              <h2 className="text-2xl font-black text-slate-950">Fiches techniques et notices</h2>
            </div>
          </div>
          <div className="mt-5 grid gap-3 text-sm font-bold leading-6 text-slate-700">
            {smartDescription.documents.map((document) => (
              <div key={document} className="rounded-2xl bg-slate-50 p-4">
                {document}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
