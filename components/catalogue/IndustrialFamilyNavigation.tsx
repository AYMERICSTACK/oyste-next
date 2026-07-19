import { ArrowRight, PackageSearch, Settings2, SlidersHorizontal } from "lucide-react";
import { getSubFamilyProductCount, slugifyCatalogueLabel, type CatalogueSubFamily } from "@/lib/catalogue/repository";

export default function IndustrialFamilyNavigation({
  categorySlug,
  title = "Familles disponibles",
  families,
  familyCounts,
}: {
  categorySlug: string;
  title?: string;
  families: CatalogueSubFamily[];
  familyCounts?: Record<string, number>;
}) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-600">
            Navigation catalogue
          </p>
          <h2 className="mt-2 text-3xl font-black text-slate-950">{title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Choisissez d’abord une famille produit. Les références apparaissent uniquement dans la famille sélectionnée, pour éviter de mélanger tous les produits d’un même univers.
          </p>
        </div>
        <a href="/catalogue" className="text-sm font-black text-[#007f8f]">
          ← Retour catalogue
        </a>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {families.map((family) => {
          const isConfigurator = family.mode === "configurator";
          const familySlug = slugifyCatalogueLabel(family.title);
          const count = familyCounts?.[familySlug] ?? getSubFamilyProductCount(categorySlug, familySlug);
          const Icon = isConfigurator ? SlidersHorizontal : PackageSearch;

          return (
            <a
              key={family.title}
              href={family.href}
              className="group relative overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-1 hover:border-orange-500 hover:bg-white hover:shadow-xl"
            >
              <div className="absolute right-4 top-4 h-2 w-12 rounded-full bg-[#007f8f] opacity-20 transition group-hover:bg-orange-500 group-hover:opacity-100" />
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#005466] shadow-sm transition group-hover:bg-[#007f8f] group-hover:text-white">
                <Icon size={22} />
              </div>

              <h3 className="mt-5 text-lg font-black text-slate-950">{family.title}</h3>
              <p className="mt-2 text-sm font-bold text-slate-600">
                {isConfigurator ? "Produit sur mesure" : count > 0 ? `${count} produits parents` : "Produits à intégrer"}
              </p>

              <p className="mt-5 flex items-center gap-2 text-sm font-black text-orange-600">
                {isConfigurator ? "Configurer" : "Voir les produits"}
                <ArrowRight size={16} className="transition group-hover:translate-x-1" />
              </p>
            </a>
          );
        })}
      </div>

      <div className="mt-8 rounded-3xl border border-orange-100 bg-orange-50 p-5">
        <div className="flex gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-orange-600">
            <Settings2 size={21} />
          </div>
          <div>
            <h3 className="font-black text-slate-950">Logique catalogue</h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Les produits standards restent consultables en catalogue. Les potences, elles, renvoient vers le configurateur pour guider le choix de la charge, de la portée, de la fixation et des options compatibles.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
