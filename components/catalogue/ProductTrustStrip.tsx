import { BadgeCheck, FileCheck2, Headphones, PackageCheck } from "lucide-react";

const items = [
  {
    icon: BadgeCheck,
    title: "Sélection professionnelle",
    description: "Des références choisies pour les usages industriels.",
  },
  {
    icon: Headphones,
    title: "Support OYSTE",
    description: "Une équipe disponible avant et après votre achat.",
  },
  {
    icon: FileCheck2,
    title: "Documentation technique",
    description: "Notices et fiches disponibles selon les références.",
  },
  {
    icon: PackageCheck,
    title: "Expédition maîtrisée",
    description: "Préparation adaptée aux contraintes du matériel.",
  },
];

export default function ProductTrustStrip() {
  return (
    <section className="grid overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm sm:grid-cols-2 xl:grid-cols-4">
      {items.map(({ icon: Icon, title, description }, index) => (
        <article
          key={title}
          className={`p-5 ${index > 0 ? "border-t border-slate-100 sm:border-l sm:border-t-0" : ""} ${index === 2 ? "sm:border-l-0 sm:border-t xl:border-l xl:border-t-0" : ""}`}
        >
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#007f8f]/10 text-[#007f8f]">
              <Icon size={21} />
            </span>
            <div>
              <h3 className="text-sm font-black text-slate-950">{title}</h3>
              <p className="mt-1 text-xs font-bold leading-5 text-slate-500">{description}</p>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
