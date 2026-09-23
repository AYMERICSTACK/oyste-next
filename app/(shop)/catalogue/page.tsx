import CategoryCard from "@/components/catalogue/CategoryCard";
import SearchBar from "@/components/catalogue/SearchBar";
import Container from "@/components/ui/Container";
import { catalogueUniverses } from "@/data/catalogue";

export default function CataloguePage() {
  return (
    <main className="bg-slate-50 text-slate-950">
      <section className="border-b border-slate-200 bg-white py-10 sm:py-12">
        <Container>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-600">Catalogue OYSTE</p>
          <div className="mt-2 grid gap-6 lg:grid-cols-[1fr_520px] lg:items-end">
            <div><h1 className="text-4xl font-black">Choisissez une catégorie</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Levage, manutention, motorisation, stockage et accès en hauteur pour les professionnels.</p></div>
            <SearchBar />
          </div>
        </Container>
      </section>
      <section className="py-10 sm:py-12">
        <Container><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{catalogueUniverses.map((category) => <CategoryCard key={category.slug} {...category} />)}</div></Container>
      </section>
    </main>
  );
}
