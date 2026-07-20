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

const commitments = [
  {
    icon: Compass,
    title: "Simplifier les achats techniques",
    text: "Une navigation claire, des informations structurées et des outils pensés pour trouver plus rapidement la bonne référence.",
  },
  {
    icon: Boxes,
    title: "Réunir l’offre au même endroit",
    text: "Levage, manutention, motorisation, stockage et accès en hauteur sont regroupés dans une seule plateforme professionnelle.",
  },
  {
    icon: ShieldCheck,
    title: "Sécuriser chaque commande",
    text: "Des parcours dédiés aux professionnels, des informations techniques accessibles et un suivi depuis l’espace client.",
  },
];

const pillars = [
  "Une plateforme exclusivement réservée aux professionnels",
  "Un catalogue structuré autour des usages industriels",
  "Des outils de configuration pour certains équipements",
  "Un espace client pour centraliser commandes et informations",
];

export const metadata = {
  title: "Qui sommes-nous ? | OYSTE",
  description:
    "Découvrez OYSTE, la plateforme professionnelle conçue pour simplifier la recherche, la configuration et la commande d’équipements industriels.",
};

export default function AboutPage() {
  return (
    <main className="bg-slate-50 text-slate-950">
      <section className="relative overflow-hidden border-b border-slate-100 bg-white py-16 lg:py-20">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#007f8f]/5 blur-3xl" />
        <Container className="relative grid gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
          <SectionHeader
            eyebrow="Qui sommes-nous ?"
            title="OYSTE, la plateforme qui simplifie vos achats industriels."
            text="OYSTE a été pensée pour offrir aux professionnels un accès plus simple, plus lisible et plus direct aux équipements dont ils ont besoin au quotidien."
          />

          <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-7 shadow-sm sm:p-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#007f8f] text-white shadow-lg shadow-[#007f8f]/20">
              <Sparkles size={27} />
            </div>
            <h2 className="mt-6 text-2xl font-black tracking-tight">
              Notre mission
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Simplifier la recherche, la configuration et la commande
              d'équipements industriels grâce à une plateforme pensée pour les
              professionnels..
            </p>
          </div>
        </Container>
      </section>

      <section className="py-16 lg:py-20">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#007f8f]">
              Notre approche
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] sm:text-4xl">
              Une expérience conçue autour des besoins professionnels
            </h2>
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
      </section>

      <section className="border-y border-slate-200 bg-white py-16 lg:py-20">
        <Container className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-600">
              Pensée pour le B2B
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] sm:text-4xl">
              Une plateforme spécialisée, pas une boutique généraliste
            </h2>
            <p className="mt-5 text-base leading-7 text-slate-600">
              OYSTE tient compte des réalités de l’achat industriel :
              caractéristiques techniques, variantes, transport adapté,
              informations d’entreprise et suivi des commandes.
            </p>
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
      </section>

      <section className="py-16 lg:py-20">
        <Container>
          <div className="flex flex-col gap-6 rounded-[2rem] border border-[#007f8f]/20 bg-[#007f8f]/5 p-7 sm:flex-row sm:items-center sm:justify-between sm:p-9">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#007f8f] shadow-sm">
                <Building2 size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black">
                  Découvrez la plateforme OYSTE
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Parcourez le catalogue ou utilisez le configurateur pour
                  préparer votre prochaine commande.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/catalogue"
                className="inline-flex items-center gap-2 rounded-xl border border-[#007f8f]/20 bg-white px-5 py-3 text-sm font-black uppercase text-[#006d7b]"
              >
                Voir le catalogue <ArrowRight size={17} />
              </Link>
              <Link
                href="/configurateur"
                className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-black uppercase text-white"
              >
                Configurer <ArrowRight size={17} />
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
