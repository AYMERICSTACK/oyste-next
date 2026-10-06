import { Fragment } from "react";
import { getEditorialPage, editorialIcon } from "@/lib/editorial";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Headphones,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import Container from "@/components/ui/Container";
import SectionHeader from "@/components/ui/SectionHeader";





export default async function ServicesPage() {
 const page = await getEditorialPage("services");
const platformServices=page.collections.platformServices.filter(item=>item.enabled).sort((a,b)=>a.order-b.order).map(item=>({...item,icon:editorialIcon(item.icon)}));
const journeySteps=page.collections.journeySteps.filter(item=>item.enabled).sort((a,b)=>a.order-b.order).map(item=>item.text);
  return (
    <main className="bg-slate-50 text-slate-950">{page.collections.pageSections.filter(block=>block.enabled).sort((a,b)=>a.order-b.order).map(block=><Fragment key={block.id}>{({"section1":(<section className="relative overflow-hidden border-b border-slate-100 bg-white py-16 lg:py-20">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#007f8f]/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-orange-500/5 blur-3xl" />

        <Container className="relative grid gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
          <SectionHeader
            eyebrow={page.fields.content001}
            title={page.fields.content002}
            text={page.fields.content003}
          />

          <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6 shadow-sm sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-orange-600">
              {page.fields.content004}</p>
            <div className="mt-5 grid gap-3">
              {journeySteps.map((step, index) => (
                <div
                  key={step}
                  className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 text-sm font-black text-slate-800 shadow-sm"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#007f8f]/10 text-sm font-black text-[#006d7b]">
                    {index + 1}
                  </span>
                  <span className="flex-1">{step}</span>
                  <CheckCircle2 className="shrink-0 text-[#0093a4]" size={19} />
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>),
"section2":(<section className="py-16 lg:py-20">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#007f8f]">
              {page.fields.content005}</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-950 sm:text-4xl">
              {page.fields.content006}</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              {page.fields.content007}</p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {platformServices.map((service) => {
              const Icon = service.icon;
              return (
                <article
                  key={service.title}
                  className="group rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#007f8f]/25 hover:shadow-xl hover:shadow-slate-200/50"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#007f8f]/10 text-[#006272] transition group-hover:bg-[#007f8f] group-hover:text-white">
                    <Icon size={27} />
                  </div>
                  <h2 className="mt-6 text-xl font-black tracking-tight text-slate-950">
                    {service.title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{service.text}</p>
                </article>
              );
            })}
          </div>
        </Container>
      </section>),
"section3":(<section className="bg-white py-16 lg:py-20">
        <Container>
          <div className="overflow-hidden rounded-[2rem] bg-[#061722] p-8 text-white shadow-2xl shadow-slate-300/40 md:p-10 lg:flex lg:items-center lg:justify-between lg:gap-10">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#67c7d1]">
                {page.fields.content008}</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] sm:text-4xl">
                {page.fields.content009}</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                {page.fields.content010}</p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:mt-0 lg:shrink-0 lg:flex-col xl:flex-row">
              <Link
                href={page.fields.content011}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-black uppercase tracking-wide text-slate-950 transition hover:-translate-y-0.5 hover:bg-slate-100"
              >
                {page.fields.content012}<ArrowRight size={17} />
              </Link>
              <Link
                href={page.fields.content013}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3.5 text-sm font-black uppercase tracking-wide text-white transition hover:-translate-y-0.5 hover:bg-orange-500"
              >
                {page.fields.content014}<ArrowRight size={17} />
              </Link>
            </div>
          </div>
        </Container>
      </section>)} as Record<string,React.ReactNode>)[block.id]}</Fragment>)}</main>
  );
}
