import { Fragment } from "react";
import { getEditorialPage, editorialIcon } from "@/lib/editorial";
import { CheckCircle2, Clock3, Factory, PackageCheck, Phone, ShieldCheck, Truck } from "lucide-react";
import Container from "@/components/ui/Container";
import { getCmsContent } from "@/lib/cms";





export default async function LivraisonPage() {
 const page = await getEditorialPage("delivery");
const modes=page.collections.modes.filter(item=>item.enabled).sort((a,b)=>a.order-b.order).map(item=>({...item,icon:editorialIcon(item.icon)}));
const faq=page.collections.faq.filter(item=>item.enabled).sort((a,b)=>a.order-b.order).map(item=>[item.question,item.answer]);
  const { editorial } = await getCmsContent();
  return (
    <main className="bg-slate-50 text-slate-950">{page.collections.pageSections.filter(block=>block.enabled).sort((a,b)=>a.order-b.order).map(block=><Fragment key={block.id}>{({"section1":(<section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.28),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(0,127,143,0.3),transparent_38%)]" />
        <Container className="relative py-16 lg:py-24">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-orange-300">{page.fields.content001}</p>
          <h1 className="mt-5 max-w-5xl text-4xl font-black tracking-tight md:text-6xl">{editorial.deliveryTitle}</h1>
          <p className="mt-6 max-w-3xl text-base font-bold leading-8 text-slate-300">{editorial.deliveryIntro}</p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm font-black">
            <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2">{page.fields.content002}</span>
            <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2">{page.fields.content003}</span>
            <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2">{page.fields.content004}</span>
          </div>
        </Container>
      </section>),
"section2":(<Container className="py-12 lg:py-16">
        <section className="grid gap-5 md:grid-cols-2">
          {modes.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#007f8f]/10 text-[#007f8f]"><Icon size={24} /></div>
              <h2 className="mt-5 text-2xl font-black">{title}</h2>
              <p className="mt-3 text-sm font-bold leading-7 text-slate-600">{text}</p>
            </article>
          ))}
        </section>

        <section className="mt-10 rounded-[2.5rem] bg-slate-950 p-7 text-white lg:p-10">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-300">{page.fields.content005}</p>
          <div className="mt-7 grid gap-4 md:grid-cols-4">
            {page.collections.list3.filter(item=>item.enabled).sort((a,b)=>a.order-b.order).map(item=>item.text).map((step, index) => (
              <div key={step} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <span className="text-sm font-black text-orange-300">{page.fields.content006}{index + 1}</span>
                <p className="mt-3 font-black">{step}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_0.7fr]">
          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-7 shadow-sm lg:p-9">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-[#007f8f]">{page.fields.content007}</p>
            <div className="mt-6 divide-y divide-slate-200">
              {faq.map(([question, answer]) => (
                <details key={question} className="group py-5">
                  <summary className="cursor-pointer list-none text-lg font-black">{question}</summary>
                  <p className="mt-3 text-sm font-bold leading-7 text-slate-600">{answer}</p>
                </details>
              ))}
            </div>
          </div>
          <aside className="rounded-[2.5rem] bg-orange-600 p-7 text-white lg:p-9">
            <ShieldCheck size={34} />
            <h2 className="mt-5 text-3xl font-black">{page.fields.content008}</h2>
            <div className="mt-6 grid gap-4 text-sm font-bold leading-6">
              <p className="flex gap-3"><Clock3 className="shrink-0" size={20} /> {page.fields.content009}</p>
              <p className="flex gap-3"><Truck className="shrink-0" size={20} /> {page.fields.content010}</p>
              <p className="flex gap-3"><Phone className="shrink-0" size={20} /> {page.fields.content011}</p>
            </div>
            <a href={page.fields.content012} className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-white px-5 py-4 text-sm font-black uppercase text-orange-700">{page.fields.content013}</a>
          </aside>
        </section>
      </Container>)} as Record<string,React.ReactNode>)[block.id]}</Fragment>)}</main>
  );
}
