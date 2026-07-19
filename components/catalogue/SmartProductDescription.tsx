import { CheckCircle2, FileText, Lightbulb, Settings2, Sparkles } from "lucide-react";
import type { CatalogueProduct } from "@/lib/catalogue/repository";
import { buildSmartDescription } from "@/lib/catalogue/smart-description";

export default function SmartProductDescription({ product }: { product: CatalogueProduct }) {
  const smartDescription = buildSmartDescription(product);

  return (
    <div className="grid gap-6">
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

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {smartDescription.technicalSpecs.map((spec) => (
              <div key={`${spec.label}-${spec.value}`} className="rounded-3xl bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{spec.label}</p>
                <p className="mt-2 text-sm font-black leading-6 text-slate-950">{spec.value}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {smartDescription.strengths.length > 0 ? (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-slate-500">Points forts</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {smartDescription.strengths.map((strength) => (
              <div key={strength} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-700">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#007f8f]" />
                <span>{strength}</span>
              </div>
            ))}
          </div>
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
