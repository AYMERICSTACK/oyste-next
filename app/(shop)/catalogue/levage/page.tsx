import { CheckCircle2, Filter, PackageSearch } from "lucide-react";
import CatalogProductGrid from "@/components/catalogue/CatalogProductGrid";
import IndustrialFamilyNavigation from "@/components/catalogue/IndustrialFamilyNavigation";
import SearchBar from "@/components/catalogue/SearchBar";
import Sidebar from "@/components/catalogue/Sidebar";
import Container from "@/components/ui/Container";
import SectionHeader from "@/components/ui/SectionHeader";
import {
  catalogueCategoryContent,
  catalogueSubFamilies,
  getCategoryFacets,
  getSubFamilyBySlug,
  filterProductsByFamily,
} from "@/lib/catalogue/repository";
import { getDatabaseProductsByCategory } from "@/lib/catalogue/database-repository";

export default async function LevagePage({
  searchParams,
}: {
  searchParams?: Promise<{ famille?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const selectedFamilySlug = resolvedSearchParams?.famille;
  const content = catalogueCategoryContent.levage;
  const subFamilies = catalogueSubFamilies.levage;
  const selectedFamily = selectedFamilySlug
    ? getSubFamilyBySlug("levage", selectedFamilySlug)
    : undefined;
  const categoryProducts = await getDatabaseProductsByCategory("levage");
  const products = selectedFamilySlug
    ? filterProductsByFamily(categoryProducts, selectedFamilySlug)
    : [];
  const familyCounts = Object.fromEntries(
    subFamilies.map((family) => {
      const familySlug = family.href.split("famille=")[1] || "";
      return [familySlug, familySlug ? filterProductsByFamily(categoryProducts, familySlug).length : 0];
    }),
  );
  const facets = getCategoryFacets(products);
  const visibleProducts = products.slice(0, 24);
  const isFamilyView = Boolean(selectedFamilySlug);

  return (
    <main className="bg-slate-50 text-slate-950">
      <section className="bg-white py-16">
        <Container className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <SectionHeader
            eyebrow="Catalogue manutention OYSTE"
            title={selectedFamily?.title || content.title}
            text={
              selectedFamily
                ? `Famille ${selectedFamily.title} : références standards consultables en catalogue OYSTE.`
                : content.description
            }
          />
          <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
            <p className="mb-4 text-xs font-black uppercase tracking-[0.22em] text-orange-600">
              {content.breadcrumb}
            </p>
            <SearchBar />
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-black text-slate-600">
              <span className="rounded-full bg-white px-3 py-1">Potences → fiches + configurateur</span>
              <span className="rounded-full bg-white px-3 py-1">Familles → navigation guidée</span>
              <span className="rounded-full bg-white px-3 py-1">Produits → uniquement après choix famille</span>
            </div>
          </div>
        </Container>
      </section>

      {!isFamilyView ? (
        <section className="border-y border-slate-200 bg-slate-50 py-14">
          <Container>
            <IndustrialFamilyNavigation
              categorySlug="levage"
              title="Familles levage"
              families={subFamilies}
              familyCounts={familyCounts}
            />
          </Container>
        </section>
      ) : null}

      {isFamilyView ? (
        <section className="bg-white py-16">
          <Container>
            <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-600">
                  Produits de la famille
                </p>
                <h2 className="mt-2 text-3xl font-black text-slate-950">
                  {selectedFamily?.title || "Famille catalogue"}
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                  Vous êtes directement dans la famille sélectionnée : les références apparaissent immédiatement, sans réafficher toutes les familles catalogue.
                </p>
              </div>
              <a href="/catalogue/levage" className="text-sm font-black text-[#007f8f]">
                ← Voir toutes les familles levage
              </a>
            </div>

            <div className="grid gap-8 lg:grid-cols-[330px_1fr]">
              <Sidebar />

              <div>
                <div className="mb-8 grid gap-4 md:grid-cols-3">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                    <PackageSearch className="text-[#007f8f]" size={24} />
                    <p className="mt-4 text-2xl font-black text-slate-950">{products.length}</p>
                    <p className="text-sm font-bold text-slate-600">produits parents</p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                    <CheckCircle2 className="text-[#007f8f]" size={24} />
                    <p className="mt-4 text-2xl font-black text-slate-950">{facets.configurableProducts.length}</p>
                    <p className="text-sm font-bold text-slate-600">produits avec variantes</p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                    <Filter className="text-[#007f8f]" size={24} />
                    <p className="mt-4 text-2xl font-black text-slate-950">{facets.totalVariants}</p>
                    <p className="text-sm font-bold text-slate-600">variantes disponibles</p>
                  </div>
                </div>

                {visibleProducts.length > 0 ? (
                  <CatalogProductGrid products={visibleProducts} />
                ) : (
                  <div className="rounded-[2rem] border border-orange-200 bg-orange-50 p-8 text-sm font-bold text-orange-800">
                    Aucun produit importé pour cette famille pour le moment.
                  </div>
                )}

                {products.length > visibleProducts.length ? (
                  <div className="mt-8 rounded-[2rem] border border-slate-200 bg-slate-50 p-6 text-sm font-bold text-slate-700">
                    Affichage des 24 premiers produits. La pagination complète arrive dans la prochaine étape catalogue.
                  </div>
                ) : null}
              </div>
            </div>
          </Container>
        </section>
      ) : null}

    </main>
  );
}
