import { HelpCircle } from "lucide-react";
import type { CatalogueFaqItem } from "@/lib/catalogue/repository";

export default function ProductFaq({ items }: { items: CatalogueFaqItem[] }) {
  if (!items.length) return null;

  return (
    <section className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#007f8f]/10 text-[#007f8f]">
          <HelpCircle size={23} />
        </span>
        <div>
          <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-600">Questions fréquentes</p>
          <h2 className="mt-2 text-3xl font-black text-slate-950">Tout savoir avant de choisir</h2>
        </div>
      </div>
      <div className="mt-7 divide-y divide-slate-200 overflow-hidden rounded-[1.75rem] border border-slate-200">
        {items.map((item, index) => (
          <details key={`${item.question}-${index}`} className="group bg-white p-5 open:bg-slate-50">
            <summary className="cursor-pointer list-none pr-8 text-sm font-black text-slate-950 marker:hidden">
              {item.question}
              <span className="float-right text-xl text-[#007f8f] group-open:rotate-45">+</span>
            </summary>
            <p className="mt-4 max-w-4xl text-sm font-medium leading-7 text-slate-600">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
