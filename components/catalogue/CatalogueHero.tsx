import {
  ArrowRight,
  BookOpen,
  Search,
  ShoppingCart,
  SlidersHorizontal,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import { catalogueHighlights } from "@/data/catalogue";

const entryPoints = [
  {
    title: "Je cherche un produit standard",
    text: "Portiques, palans, manutention au sol, stockage, accès hauteur ou accessoires : parcourez les univers catalogue.",
    icon: BookOpen,
    href: "#univers",
    cta: "Voir les univers",
  },
  {
    title: "Je veux configurer une potence",
    text: "Pour les potences, l'assistant remplace les menus techniques : charge, portée, fixation, hauteur, options et palan.",
    icon: SlidersHorizontal,
    href: "/configurateur",
    cta: "Lancer l’assistant",
    highlight: true,
  },
  {
    title: "Je connais ma référence",
    text: "Tapez une référence, un nom produit ou une famille pour accéder rapidement au bon équipement.",
    icon: Search,
    href: "#recherche",
    cta: "Rechercher",
  },
];

export default function CatalogueHero() {
  return (
    <section className="relative overflow-hidden bg-white">
      <div className="absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(circle_at_center,rgba(0,127,143,0.1),transparent_62%)]" />
      <Container className="relative grid gap-10 py-16 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.35em] text-orange-600">
            Catalogue OYSTE
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl font-black leading-tight tracking-tight text-slate-950 md:text-6xl">
            Un catalogue industriel clair, séparé du configurateur.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            Les potences sont guidées par l’assistant métier. Les portiques,
            palans, équipements de manutention, accès hauteur, stockage et pièces
            restent organisés en univers catalogue.
          </p>

          <div
            id="recherche"
            className="mt-8 flex max-w-xl items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg shadow-slate-200/60"
          >
            <Search className="ml-3 text-[#007f8f]" size={22} />
            <input
              placeholder="Rechercher : portique, transpalette, palan, SEW..."
              className="h-12 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
            />
            <button className="hidden rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white md:block">
              Rechercher
            </button>
          </div>

          <div className="mt-7 flex flex-wrap gap-4">
            <Button href="/configurateur">
              Configurer une potence <SlidersHorizontal size={18} />
            </Button>
            <Button href="#univers" variant="secondary">
              Découvrir le catalogue <ArrowRight size={18} />
            </Button>
          </div>
        </div>

        <div className="grid gap-4">
          {entryPoints.map((entry) => {
            const Icon = entry.icon;
            return (
              <a
                key={entry.title}
                href={entry.href}
                className={`group rounded-[2rem] border p-6 transition hover:-translate-y-1 hover:shadow-xl ${
                  entry.highlight
                    ? "border-orange-500 bg-orange-50 shadow-lg shadow-orange-100"
                    : "border-slate-200 bg-white hover:border-[#007f8f]"
                }`}
              >
                <div className="flex items-start gap-5">
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
                      entry.highlight
                        ? "bg-orange-600 text-white"
                        : "bg-[#007f8f]/10 text-[#005466]"
                    }`}
                  >
                    <Icon size={27} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-4">
                      <h2 className="text-xl font-black text-slate-950">
                        {entry.title}
                      </h2>
                      <ArrowRight
                        size={20}
                        className="text-orange-600 transition group-hover:translate-x-1"
                      />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {entry.text}
                    </p>
                    <p className="mt-4 text-sm font-black uppercase text-[#005466]">
                      {entry.cta}
                    </p>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </Container>

      <div className="border-t border-slate-200 bg-slate-50">
        <Container className="grid gap-4 py-5 md:grid-cols-3">
          {catalogueHighlights.map((item) => (
            <div key={item.label} className="flex items-center gap-4">
              <span className="text-3xl font-black text-[#007f8f]">{item.value}</span>
              <span className="text-sm font-bold leading-5 text-slate-600">
                <strong className="block text-slate-950">{item.label}</strong>
                {item.text}
              </span>
            </div>
          ))}
          <span className="hidden items-center gap-2 text-sm font-black text-[#005466] md:flex">
            <ShoppingCart size={17} /> Catalogue prêt pour panier et achat en ligne
          </span>
        </Container>
      </div>
    </section>
  );
}
