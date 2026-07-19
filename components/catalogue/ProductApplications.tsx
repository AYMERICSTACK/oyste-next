import {
  Boxes,
  Factory,
  Forklift,
  PackageCheck,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import type { CatalogueProduct } from "@/lib/catalogue/repository";

const applicationItems = [
  {
    icon: Factory,
    title: "Industrie",
    description: "Équipement adapté aux environnements de production et aux usages professionnels réguliers.",
  },
  {
    icon: Wrench,
    title: "Maintenance",
    description: "Une solution pensée pour faciliter les opérations de maintenance, de montage et d'intervention.",
  },
  {
    icon: Forklift,
    title: "Logistique",
    description: "Pour fluidifier les déplacements, les manutentions et l'organisation des zones de travail.",
  },
  {
    icon: Boxes,
    title: "Atelier",
    description: "Une réponse fiable aux besoins quotidiens des ateliers, postes de travail et zones techniques.",
  },
  {
    icon: PackageCheck,
    title: "Préparation",
    description: "Pour sécuriser les opérations de préparation, de conditionnement et de manipulation des charges.",
  },
  {
    icon: ShieldCheck,
    title: "Usage professionnel",
    description: "Sélectionné pour répondre aux contraintes de robustesse, de sécurité et de durabilité.",
  },
];

function getApplicationProductLabel(product: CatalogueProduct) {
  const categoryLabel = product.categoryPath
    ?.split(/[\\/]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .at(-1);

  return categoryLabel || product.name;
}

export default function ProductApplications({ product }: { product: CatalogueProduct }) {
  const productContext = getApplicationProductLabel(product);

  return (
    <section className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm lg:p-8">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-300">Applications</p>
          <h2 className="mt-2 max-w-3xl text-3xl font-black">Pensé pour les contraintes du terrain</h2>
          <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-slate-300">
            Ce produit de la famille « {productContext} » s&apos;intègre dans de nombreux environnements professionnels. Le choix final dépend de la charge, de la fréquence d&apos;utilisation et des conditions d&apos;exploitation.
          </p>
        </div>
        <span className="w-fit rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-200">
          Conseil technique OYSTE
        </span>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {applicationItems.map(({ icon: Icon, title, description }) => (
          <article key={title} className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 transition hover:-translate-y-1 hover:bg-white/10">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-400 text-slate-950">
              <Icon size={21} />
            </span>
            <h3 className="mt-5 text-lg font-black">{title}</h3>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-300">{description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
