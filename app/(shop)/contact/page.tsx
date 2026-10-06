import { Fragment } from "react";
import { getEditorialPage, editorialIcon } from "@/lib/editorial";
import type { Metadata } from "next";
import {
  ArrowUpRight,
  Clock3,
  Headphones,
  Mail,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import ContactForm from "@/components/contact/ContactForm";
import Container from "@/components/ui/Container";
import { getCmsContent } from "@/lib/cms";

export async function generateMetadata(){const page=await getEditorialPage("contact");return {title: page.fields.content008,description: page.fields.content009};}





export default async function ContactPage() {
 const page = await getEditorialPage("contact");
const contactCards=page.collections.contactCards.filter(item=>item.enabled).sort((a,b)=>a.order-b.order).map(item=>({...item,icon:editorialIcon(item.icon)}));
const promises=page.collections.promises.filter(item=>item.enabled).sort((a,b)=>a.order-b.order).map(item=>({...item,icon:editorialIcon(item.icon)}));
  const { editorial } = await getCmsContent();
  return (
    <main className="overflow-hidden bg-slate-50 text-slate-950">{page.collections.pageSections.filter(block=>block.enabled).sort((a,b)=>a.order-b.order).map(block=><Fragment key={block.id}>{({"section1":(<section className="relative bg-[#071827] py-20 text-white sm:py-24 lg:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(0,127,143,0.34),transparent_35%),radial-gradient(circle_at_10%_80%,rgba(242,90,29,0.15),transparent_30%)]" />
        <div className="absolute -right-28 top-12 h-72 w-72 rounded-full border border-white/10" />
        <div className="absolute -right-10 top-32 h-72 w-72 rounded-full border border-white/5" />

        <Container className="relative grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-[#8fd5dc] backdrop-blur">
              <Sparkles size={15} />
              {page.fields.content001}</div>
            <h1 className="mt-7 text-5xl font-black leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              {editorial.contactTitle}
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
              {editorial.contactIntro}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {promises.map((promise) => {
              const Icon = promise.icon;
              return (
                <article
                  key={promise.title}
                  className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#007f8f] text-white">
                    <Icon size={22} />
                  </div>
                  <h2 className="mt-4 text-base font-black">{promise.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {promise.text}
                  </p>
                </article>
              );
            })}
          </div>
        </Container>
      </section>),
"section2":(<section className="relative py-16 sm:py-20 lg:py-24">
        <Container className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
          <aside className="lg:sticky lg:top-28">
            <p className="text-sm font-black uppercase tracking-[0.3em] text-orange-600">
              {page.fields.content002}</p>
            <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight text-slate-950">
              {page.fields.content003}</h2>
            <p className="mt-5 text-base leading-7 text-slate-600">
              {page.fields.content004}</p>

            <div className="mt-8 grid gap-4">
              {contactCards.map((item) => {
                const Icon = item.icon;
                const card = (
                  <article className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#007f8f]/40 hover:shadow-lg">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#007f8f]/10 text-[#005466]">
                        <Icon size={23} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">
                          {item.label}
                        </p>
                        <p className="mt-1 flex items-center gap-2 text-lg font-black text-slate-950">
                          {item.value}
                          {item.href && (
                            <ArrowUpRight
                              className="opacity-0 transition group-hover:opacity-100"
                              size={17}
                            />
                          )}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          {item.text}
                        </p>
                      </div>
                    </div>
                  </article>
                );

                return item.href ? (
                  <a key={item.label} href={item.href}>
                    {card}
                  </a>
                ) : (
                  <div key={item.label}>{card}</div>
                );
              })}
            </div>

            <div className="mt-5 rounded-3xl bg-[#007f8f] p-6 text-white">
              <div className="flex items-center gap-3">
                <Clock3 size={22} />
                <p className="font-black">{page.fields.content005}</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-white/80">
                {page.fields.content006}<br />
                {page.fields.content007}</p>
            </div>
          </aside>

          <div id="formulaire" className="scroll-mt-32">
            <ContactForm content={page.fields} />
          </div>
        </Container>
      </section>)} as Record<string,React.ReactNode>)[block.id]}</Fragment>)}</main>
  );
}
