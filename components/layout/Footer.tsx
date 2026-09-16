import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  Headphones,
  Mail,
  MapPin,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import Container from "@/components/ui/Container";
import { getCmsContent } from "@/lib/cms";

const universeLinks = [
  { label: "Levage", href: "/catalogue/levage" },
  { label: "Manutention au sol", href: "/catalogue/manutention-au-sol" },
  { label: "Motorisation SEW", href: "/catalogue/motorisation-sew" },
  { label: "Stockage & emballage", href: "/catalogue/stockage-emballage" },
  { label: "Accès en hauteur", href: "/catalogue/acces-hauteur" },
];

const supportLinks = [
  { label: "Configurateur", href: "/configurateur" },
  { label: "Pourquoi OYSTE ?", href: "/services" },
  { label: "Qui sommes-nous ?", href: "/a-propos" },
  { label: "Livraison", href: "/livraison" },
  { label: "Nous contacter", href: "/contact" },
];

const assurances = [
  {
    icon: Headphones,
    title: "Expertise métier",
    text: "Un accompagnement technique à chaque étape.",
  },
  {
    icon: Truck,
    title: "Logistique maîtrisée",
    text: "Une solution adaptée à chaque équipement.",
  },
  {
    icon: ShieldCheck,
    title: "Plateforme 100 % B2B",
    text: "Des solutions réservées aux professionnels.",
  },
];

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
        <section className="grid gap-8 border-b border-white/10 py-12 lg:grid-cols-[1fr_auto] lg:items-center lg:py-16">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#67c7d1]/25 bg-[#67c7d1]/8 px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-[#84d2db]">
              <Sparkles size={14} />
              {footer.ctaEyebrow}
            </div>
            <h2 className="mt-5 text-3xl font-black leading-tight tracking-[-0.03em] sm:text-4xl lg:text-[2.75rem]">
              {footer.ctaTitle}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              {footer.ctaText}
            </p>
          </div>

          <Link
            href={footer.ctaHref}
            className="group inline-flex w-fit items-center gap-3 rounded-2xl bg-orange-600 px-7 py-4 text-sm font-black uppercase tracking-wide text-white shadow-[0_18px_50px_rgba(234,88,12,0.22)] transition duration-300 hover:-translate-y-1 hover:bg-orange-500"
          >
            {footer.ctaLabel}
            <ArrowRight
              size={18}
              className="transition-transform group-hover:translate-x-1"
            />
          </Link>
        </section>

        <div className="grid gap-12 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_0.8fr_1fr] lg:gap-12 lg:py-16">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link
              href="/"
              aria-label="Retour à l’accueil OYSTE"
              className="inline-flex items-center rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-4 shadow-2xl shadow-black/10 transition hover:border-white/20 hover:bg-white/[0.055]"
            >
              <img
                src="/logos/oyste-logo-transparent.png"
                alt="OYSTE"
                className="h-14 w-auto"
              />
            </Link>

            <p className="mt-6 max-w-sm text-sm leading-7 text-slate-400">
              {footer.description}
            </p>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#0f8e9d]/45 bg-[#0f8e9d]/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#84d2db]">
              <ShieldCheck size={15} />
              Réservé aux professionnels
            </div>
          </div>

          <nav aria-label="Univers OYSTE">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-white">
              Nos univers
            </p>
            <ul className="mt-6 grid gap-3.5">
              {universeLinks.map((item) => (
                <li key={item.href}>
                  <FooterLink {...item} />
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Informations OYSTE">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-white">
              OYSTE
            </p>
            <ul className="mt-6 grid gap-3.5">
              {supportLinks.map((item) => (
                <li key={item.href}>
                  <FooterLink {...item} />
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-white">
              Nous joindre
            </p>

            <div className="mt-6 grid gap-5 text-sm">
              <a
                href={`mailto:${footer.email}`}
                className="group flex items-start gap-3 text-slate-400 transition hover:text-white"
              >
                <Mail size={18} className="mt-0.5 shrink-0 text-[#67c7d1]" />
                <span>
                  <span className="block text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    E-mail
                  </span>
                  <span className="mt-1 block font-bold">{footer.email}</span>
                </span>
              </a>

              <div className="flex items-start gap-3 text-slate-400">
                <Clock3 size={18} className="mt-0.5 shrink-0 text-[#67c7d1]" />
                <span>
                  <span className="block text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    Horaires
                  </span>
                  <span className="mt-1 block leading-6">
                    {footer.hours.split("\n").map((line) => <span key={line} className="block">{line}</span>)}
                  </span>
                </span>
              </div>

              <div className="flex items-start gap-3 text-slate-400">
                <MapPin size={18} className="mt-0.5 shrink-0 text-[#67c7d1]" />
                <span>
                  <span className="block text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    Secteur
                  </span>
                  <span className="mt-1 block font-bold">{footer.area}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-white/10 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {currentYear} OYSTE. Tous droits réservés.</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <span>Vente exclusivement professionnelle</span>
            <span>Prix affichés hors taxes</span>
          </div>
        </div>
      </Container>
    </footer>
  );
}
