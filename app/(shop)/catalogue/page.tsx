import CatalogueHero from "@/components/catalogue/CatalogueHero";
import CategoryCard from "@/components/catalogue/CategoryCard";
import ProductGrid from "@/components/catalogue/ProductGrid";
import SearchBar from "@/components/catalogue/SearchBar";
import Sidebar from "@/components/catalogue/Sidebar";
import Container from "@/components/ui/Container";
import SectionHeader from "@/components/ui/SectionHeader";
import { catalogueUniverses, serviceHighlights } from "@/data/catalogue";
import { getDatabaseFeaturedProducts } from "@/lib/catalogue/database-repository";

export default async function CataloguePage() {
  const featuredProducts = await getDatabaseFeaturedProducts(6);
  return (
    <main className="bg-slate-50 text-slate-950">
      <CatalogueHero />

      <section id="univers" className="border-y border-slate-200 bg-slate-50 py-16">
        <Container>
          <div className="mb-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <SectionHeader
              eyebrow="Univers catalogue"
              title="Un accès clair à toutes les gammes OYSTE."
              text="Le catalogue est maintenant structuré par vrais univers : levage, manutention au sol, motorisation SEW, stockage et emballage, accès en hauteur. Les potences restent visibles en fiches produit SEO, avec un accès direct au configurateur."
            />
            <div className="w-full max-w-xl">
              <SearchBar />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {catalogueUniverses.map((family) => (
              <CategoryCard key={family.slug} {...family} />
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-white py-16">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[330px_1fr]">
            <Sidebar />
            <ProductGrid products={featuredProducts} />
          </div>
        </Container>
      </section>

      <section className="bg-slate-950 py-16 text-white">
        <Container>
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <SectionHeader
              eyebrow="Architecture catalogue"
              title="Le configurateur reste un module, le catalogue devient la plateforme."
              text="Cette séparation évite de mélanger les produits standards avec les familles qui nécessitent un accompagnement métier."
              className="[&_h2]:text-white [&_p]:text-slate-300"
            />
            <div className="grid gap-4 md:grid-cols-3">
              {serviceHighlights.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-3xl bg-white/10 p-6 ring-1 ring-white/10">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#005466]">
                      <Icon size={24} />
                    </div>
                    <h3 className="mt-5 font-black text-white">{item.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{item.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
