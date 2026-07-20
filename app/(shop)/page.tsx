import {
  ArrowRight,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import SectionHeader from "@/components/ui/SectionHeader";
import { mainFamilies, serviceHighlights } from "@/data/catalogue";
import { getCmsContent } from "@/lib/cms";

const advantages = [
  {
    icon: Truck,
    title: "Livraison rapide",
    text: "Partout en France et en Europe",
  },
  {
    icon: ShieldCheck,
    title: "Produits certifiés",
    text: "Normes CE et contrôles qualité rigoureux",
  },
  {
    icon: ShoppingCart,
    title: "Assistant d’achat",
    text: "Configurez, voyez le prix puis commandez",
  },
];

const univers = mainFamilies.slice(0, 5);

export default async function HomePage() {
  const { home } = await getCmsContent();
  return (
    <main className="bg-white text-slate-950">
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-slate-50 to-slate-100">
        <div className="absolute right-0 top-0 hidden h-full w-[55%] bg-[radial-gradient(circle_at_center,rgba(0,127,143,0.10),transparent_64%)] lg:block" />

        <Container className="relative grid min-h-[520px] items-center gap-10 py-10 lg:grid-cols-[0.9fr_1.1fr] xl:min-h-[560px] xl:py-12">
          <div className="relative z-10 max-w-3xl">
            <h1 className="text-4xl font-black leading-[0.96] tracking-tight text-slate-950 md:text-6xl xl:text-7xl">
              {home.heroTitle}
              <span className="block text-[#007f8f]">{home.heroAccent}</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-700 md:text-xl md:leading-9">
              {home.heroText}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm font-black text-slate-950 md:text-base">
              {[
                "Potences",
                "Palans",
                "Portiques",
                "Motorisation",
                "Manutention",
              ].map((item, index) => (
                <span key={item} className="flex items-center gap-3">
                  {item}
                  {index < 4 && <span className="text-orange-600">•</span>}
                </span>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-5">
              <Button href={home.primaryHref}>
                {home.primaryLabel} <ArrowRight size={20} />
              </Button>
              <Button href={home.secondaryHref} variant="secondary">
                {home.secondaryLabel} <SlidersHorizontal size={20} />
              </Button>
            </div>
          </div>

          <div className="relative hidden lg:block">
            <div className="relative ml-auto overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl shadow-slate-300/50">
              <img
                src={home.heroImage}
                alt="Potence industrielle OYSTE avec palan KITO"
                className="h-[430px] w-full object-cover object-center xl:h-[470px]"
              />
              <div className="absolute left-5 top-5 rounded-full bg-white/90 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[#005466] shadow-lg">
                Assistant potence
              </div>
            </div>
          </div>
        </Container>

        <Container className="relative grid gap-4 pb-10 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          {advantages.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60"
              >
                <div className="flex items-center gap-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#007f8f]/10 text-[#005466]">
                    <Icon size={28} />
                  </div>
                  <div>
                    <h3 className="font-black uppercase text-slate-950">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm leading-5 text-slate-600">
                      {item.text}
                    </p>
                  </div>
                </div>
                <div className="mt-5 h-1 w-10 rounded-full bg-orange-600" />
              </div>
            );
          })}
        </Container>
      </section>

      <section className="bg-white py-16">
        <Container className="grid gap-10 lg:grid-cols-[330px_1fr]">
          <SectionHeader
            eyebrow="Nos univers"
            title="Trouvez l’équipement adapté à votre besoin"
          />

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
            {univers.map((family) => {
              const Icon = family.icon;
              return (
                <a
                  key={family.slug}
                  href={family.href}
                  className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-orange-500 hover:shadow-xl"
                >
                  <div className="flex aspect-square items-center justify-center rounded-2xl bg-slate-50 text-[#007f8f] transition group-hover:bg-[#007f8f] group-hover:text-white">
                    <Icon size={54} strokeWidth={1.8} />
                  </div>
                  <div className="mt-5 flex items-center justify-between gap-4">
                    <h3 className="font-black text-slate-950">
                      {family.title}
                    </h3>
                    <ArrowRight
                      size={18}
                      className="text-orange-600 transition group-hover:translate-x-1"
                    />
                  </div>
                </a>
              );
            })}
          </div>
        </Container>
      </section>

      <section className="bg-slate-50 py-16">
        <Container>
          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60 md:p-12">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <SectionHeader
                eyebrow="Expérience d’achat OYSTE"
                title="Une nouvelle façon d’acheter votre matériel industriel."
                text="Le client avance par besoins : charge, portée, fixation, palan et accessoires. À chaque choix, le prix se met à jour pour construire une solution complète directement commandable."
              />

              <div className="grid gap-4 md:grid-cols-3">
                {serviceHighlights.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.title}
                      className="rounded-3xl bg-slate-50 p-6"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#007f8f]/10 text-[#005466]">
                        <Icon size={24} />
                      </div>
                      <h3 className="mt-5 font-black text-slate-950">
                        {item.title}
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {item.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
