import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { getProductImageUrl } from "@/lib/product-images";
import { getProductMediaImages, getProductsByCategoryAndFamily, slugifyCatalogueLabel, type CatalogueSubFamily } from "@/lib/catalogue/repository";

const FAMILY_IMAGE_REFS: Record<string, string> = {
  "elevateur-de-charge": "LP1",
  palan: "CB010",
  "potence-murale": "PMI2502000",
  nacelle: "MA50SF",
};

const FAMILY_IMAGE_URLS: Record<string, string> = {
  marchepied:
    "https://media.normequip.com/2241006-large_default/marchepieds-en-acier-150-kg.jpg",
  "plate-forme-individuelle-modulable":
    "https://www.tubesca-comabi.com/sites/default/files/erp/VISUELS-FR/MODUL-ACCESS/MECA_MODUL/SOLUTIONS-MODULAIRES_MECA-MODUL_DETAIL_1.png",
};

export default function IndustrialFamilyNavigation({
  categorySlug,
  title = "Catégories disponibles",
  families,
  familyCounts: _familyCounts,
}: {
  categorySlug: string;
  title?: string;
  families: CatalogueSubFamily[];
  familyCounts?: Record<string, number>;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h2 className="text-2xl font-black text-slate-950">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Choisissez une catégorie pour afficher les équipements correspondants.</p>
        </div>
        <Link href="/catalogue" className="text-sm font-black text-[#007f8f]">
          ← Retour catalogue
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {families.map((family) => {
          const isConfigurator = family.mode === "configurator";
          const familySlug = slugifyCatalogueLabel(family.title);
          const representativeProduct = getProductsByCategoryAndFamily(categorySlug, familySlug)[0];
          const curatedImageRef = FAMILY_IMAGE_REFS[familySlug];
          const imageUrl = FAMILY_IMAGE_URLS[familySlug]
            ?? (curatedImageRef
              ? getProductImageUrl(curatedImageRef)
              : representativeProduct
                ? getProductMediaImages(representativeProduct)[0] || getProductImageUrl(representativeProduct.imageRef, representativeProduct.code)
                : getProductImageUrl(family.title));

          return (
            <a
              key={family.title}
              href={family.href}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:-translate-y-1 hover:border-orange-500 hover:bg-white hover:shadow-lg"
            >
              <div className="absolute right-4 top-4 h-2 w-12 rounded-full bg-[#007f8f] opacity-20 transition group-hover:bg-orange-500 group-hover:opacity-100" />
              <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-white shadow-sm">
                <img
                  src={imageUrl}
                  alt={family.title}
                  className="h-full w-full object-contain p-3 transition duration-300 group-hover:scale-105"
                />
              </div>

              <h3 className="mt-3 text-base font-black text-slate-950">{family.title}</h3>
              {familySlug === "palan" ? <p className="mt-1 text-xs leading-5 text-slate-600">Électriques · manuels · chariots porte-palan</p> : null}

              <p className="mt-3 flex items-center gap-2 text-xs font-black text-orange-600">
                {isConfigurator ? "Configurer" : "Voir les produits"}
                <ArrowRight size={16} className="transition group-hover:translate-x-1" />
              </p>
            </a>
          );
        })}
      </div>

    </div>
  );
}
