import { getEditorialPage, editorialIcon } from "@/lib/editorial";
import Link from "next/link";
import {
  Clock3,
  Headphones,
  Mail,
  MapPin,
  ShieldCheck,
  Truck,
} from "lucide-react";
import Container from "@/components/ui/Container";
import { getCmsContent } from "@/lib/cms";







function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
    >
      <span className="h-px w-0 bg-[#67c7d1] transition-all duration-300 group-hover:w-4" />
      {label}
    </Link>
  );
}

export default async function Footer() {
 const page=await getEditorialPage("footer");
const universeLinks=page.collections.universeLinks.filter(item=>item.enabled).sort((a,b)=>a.order-b.order).map(item=>({...item}));
const supportLinks=page.collections.supportLinks.filter(item=>item.enabled).sort((a,b)=>a.order-b.order).map(item=>({...item}));
const assurances=page.collections.assurances.filter(item=>item.enabled).sort((a,b)=>a.order-b.order).map(item=>({...item,icon:editorialIcon(item.icon)}));
  const currentYear = new Date().getFullYear();
  const { footer } = await getCmsContent();

  return (
    <footer className="relative overflow-hidden bg-[#04111b] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_22%,rgba(0,127,143,0.16),transparent_34%),radial-gradient(circle_at_18%_78%,rgba(249,115,22,0.08),transparent_28%)]" />

      <div className="relative border-b border-white/10 bg-[#087f8d]">
        <Container className="grid gap-6 py-6 md:grid-cols-3 md:gap-0">
          {assurances.map((item, index) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className={`flex items-start gap-4 md:px-8 ${
                  index > 0 ? "md:border-l md:border-white/20" : ""
                } ${index === 0 ? "md:pl-0" : ""}`}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-inner shadow-white/5">
                  <Icon size={21} strokeWidth={2.15} />
                </div>
                <div>
                  <p className="font-black tracking-tight">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-white/75">{item.text}</p>
                </div>
              </div>
            );
          })}
        </Container>
      </div>

      <Container className="relative">
        <div className="grid gap-10 py-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_0.8fr_1fr] lg:gap-10">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link
              href={page.fields.content001}
              aria-label="Retour à l’accueil OYSTE"
              className="inline-flex items-center rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-4 shadow-2xl shadow-black/10 transition hover:border-white/20 hover:bg-white/[0.055]"
            >
              <img
                src={page.fields.content002}
                alt={page.fields.content003}
                className="h-14 w-auto"
              />
            </Link>

            <p className="mt-6 max-w-sm text-sm leading-7 text-slate-400">
              {footer.description}
            </p>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#0f8e9d]/45 bg-[#0f8e9d]/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#84d2db]">
              <ShieldCheck size={15} />
              {page.fields.content004}</div>
          </div>

          <nav aria-label="Catégories OYSTE">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-white">
              {page.fields.content005}</p>
            <ul className="mt-4 grid gap-2.5">
              {universeLinks.map((item) => (
                <li key={item.href}>
                  <FooterLink {...item} />
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Informations OYSTE">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-white">
              {page.fields.content006}</p>
            <ul className="mt-4 grid gap-2.5">
              {supportLinks.map((item) => (
                <li key={item.href}>
                  <FooterLink {...item} />
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-white">
              {page.fields.content007}</p>

            <div className="mt-6 grid gap-5 text-sm">
              <a
                href={`mailto:${footer.email}`}
                className="group flex items-start gap-3 text-slate-400 transition hover:text-white"
              >
                <Mail size={18} className="mt-0.5 shrink-0 text-[#67c7d1]" />
                <span>
                  <span className="block text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    {page.fields.content008}</span>
                  <span className="mt-1 block font-bold">{footer.email}</span>
                </span>
              </a>

              <div className="flex items-start gap-3 text-slate-400">
                <Clock3 size={18} className="mt-0.5 shrink-0 text-[#67c7d1]" />
                <span>
                  <span className="block text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    {page.fields.content009}</span>
                  <span className="mt-1 block leading-6">
                    {footer.hours.split("\n").map((line) => <span key={line} className="block">{line}</span>)}
                  </span>
                </span>
              </div>

              <div className="flex items-start gap-3 text-slate-400">
                <MapPin size={18} className="mt-0.5 shrink-0 text-[#67c7d1]" />
                <span>
                  <span className="block text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    {page.fields.content010}</span>
                  <span className="mt-1 block font-bold">{footer.area}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-white/10 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>{page.fields.content011}{currentYear} {page.fields.content012}</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href={page.fields.content013} className="transition hover:text-white">
              {page.fields.content014}</Link>
            <span>{page.fields.content015}</span>
            <span>{page.fields.content016}</span>
          </div>
        </div>
      </Container>
    </footer>
  );
}
