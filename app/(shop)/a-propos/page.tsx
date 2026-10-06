import { Fragment } from "react";
import { getEditorialPage, editorialIcon } from "@/lib/editorial";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Building2,
  CheckCircle2,
  Compass,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Container from "@/components/ui/Container";
import SectionHeader from "@/components/ui/SectionHeader";





export async function generateMetadata(){const page=await getEditorialPage("about");return {title: page.fields.content017,description: page.fields.content018};}

export default async function AboutPage() {
 const page = await getEditorialPage("about");
const commitments=page.collections.commitments.filter(item=>item.enabled).sort((a,b)=>a.order-b.order).map(item=>({...item,icon:editorialIcon(item.icon)}));
const pillars=page.collections.pillars.filter(item=>item.enabled).sort((a,b)=>a.order-b.order).map(item=>item.text);
  return (
    <main className="bg-slate-50 text-slate-950">{page.collections.pageSections.filter(block=>block.enabled).sort((a,b)=>a.order-b.order).map(block=><Fragment key={block.id}>{({"section1":(<section className="relative overflow-hidden border-b border-slate-100 bg-white py-16 lg:py-20">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#007f8f]/5 blur-3xl" />
        <Container className="relative grid gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
          <SectionHeader
            eyebrow={page.fields.content001}
            title={page.fields.content002}
            text={page.fields.content003}
          />

          <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-7 shadow-sm sm:p-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#007f8f] text-white shadow-lg shadow-[#007f8f]/20">
              <Sparkles size={27} />
            </div>
            <h2 className="mt-6 text-2xl font-black tracking-tight">
              {page.fields.content004}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {page.fields.content005}</p>
          </div>
        </Container>
      </section>),
"section2":(<section className="py-16 lg:py-20">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#007f8f]">
              {page.fields.content006}</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] sm:text-4xl">
              {page.fields.content007}</h2>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {commitments.map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.title}
                  className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#007f8f]/10 text-[#006272]">
                    <Icon size={27} />
                  </div>
                  <h3 className="mt-6 text-xl font-black tracking-tight">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {item.text}
                  </p>
                </article>
              );
            })}
          </div>
        </Container>
      </section>),
"section3":(<section className="border-y border-slate-200 bg-white py-16 lg:py-20">
        <Container className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-600">
              {page.fields.content008}</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] sm:text-4xl">
              {page.fields.content009}</h2>
            <p className="mt-5 text-base leading-7 text-slate-600">
              {page.fields.content010}</p>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6 sm:p-8">
            <div className="grid gap-4">
              {pillars.map((pillar) => (
                <div
                  key={pillar}
                  className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
                >
                  <CheckCircle2
                    className="mt-0.5 shrink-0 text-[#0093a4]"
                    size={20}
                  />
                  <span className="text-sm font-bold leading-6 text-slate-700">
                    {pillar}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>),
"section4":(<section className="py-16 lg:py-20">
        <Container>
          <div className="flex flex-col gap-6 rounded-[2rem] border border-[#007f8f]/20 bg-[#007f8f]/5 p-7 sm:flex-row sm:items-center sm:justify-between sm:p-9">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#007f8f] shadow-sm">
                <Building2 size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black">
                  {page.fields.content011}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {page.fields.content012}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={page.fields.content013}
                className="inline-flex items-center gap-2 rounded-xl border border-[#007f8f]/20 bg-white px-5 py-3 text-sm font-black uppercase text-[#006d7b]"
              >
                {page.fields.content014}<ArrowRight size={17} />
              </Link>
              <Link
                href={page.fields.content015}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-black uppercase text-white"
              >
                {page.fields.content016}<ArrowRight size={17} />
              </Link>
            </div>
          </div>
        </Container>
      </section>)} as Record<string,React.ReactNode>)[block.id]}</Fragment>)}</main>
  );
}
