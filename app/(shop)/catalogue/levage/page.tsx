import { getPublicCategory } from "@/lib/catalogue/public-presentation";
import { getEditorialPage, editorialIcon } from "@/lib/editorial";
import { notFound } from "next/navigation";
import { getPublicPresentation, publicFamilies, familyProducts as selectFamilyProducts } from "@/lib/catalogue/public-presentation";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import CatalogProductGrid from "@/components/catalogue/CatalogProductGrid";
import IndustrialFamilyNavigation from "@/components/catalogue/IndustrialFamilyNavigation";
import Container from "@/components/ui/Container";
import { catalogueCategoryContent, catalogueSubFamilies, getSubFamilyBySlug, filterProductsByFamily } from "@/lib/catalogue/repository";
import { getDatabaseProductsByCategory } from "@/lib/catalogue/database-repository";
import { getProductImageUrl } from "@/lib/product-images";

const palanTypes = [
  { id: "electrique", title: "Palan électrique", image: "ER2M010ILIS" },
  { id: "manuel", title: "Palan manuel", image: "CB010" },
  { id: "chariot", title: "Chariot porte-palan manuel", image: "TSG1000B" },
] as const;

function matchesPalanType(product: { name: string; description: string; code: string }, type?: string) {
  if (!type) return true;
  const source = `${product.name} ${product.description} ${product.code}`;
  const reference = product.code.trim().toUpperCase();
  const isManualTrolley = /^(TSG|TSP)/.test(reference);
  const isElectricRange = /^(ER2M|EQM|EQSP|CET)/.test(reference) || /électri|electri|motoris/i.test(source);
  if (type === "chariot") return isManualTrolley || (/chariot|porte.?palan|trolley/i.test(source) && !isElectricRange);
  if (type === "electrique") return isElectricRange;
  if (type === "manuel") return !isManualTrolley && !isElectricRange && /manuel|chaîne|chaine|levier/i.test(source) && !/chariot/i.test(source);
  return true;
}

export default async function LevagePage({ searchParams }: { searchParams?: Promise<{ famille?: string; type?: string }> }) {
 const page = await getEditorialPage("levage");

  const query = await searchParams;
  const selectedFamilySlug = query?.famille;
  const selectedType = query?.type;
  const { categories } = await getPublicPresentation();
  const category = categories.find(item => item.slug === "levage" && item.isActive && item.catalogueVisible);
  if (!category) return notFound();
  const content = { title: category.publicLabel || category.name, description: category.description || "" };
  const subFamilies = publicFamilies(categories, category);
  const selectedFamily = selectedFamilySlug ? subFamilies.find(item => item.publicFamilySlug === selectedFamilySlug || item.slug === selectedFamilySlug) : undefined;
  const categoryProducts = await getDatabaseProductsByCategory("levage");
  const familyProducts = selectedFamily ? selectFamilyProducts(categoryProducts, selectedFamily, filterProductsByFamily) : [];
  const products = familyProducts.filter((product) => matchesPalanType(product, selectedFamilySlug === "palan" ? selectedType : undefined));
  const familyCounts = Object.fromEntries(subFamilies.map((family) => {
    const slug = family.publicFamilySlug || family.slug;
    return [slug, slug ? selectFamilyProducts(categoryProducts, family, filterProductsByFamily).length : 0];
  }));
  const showPalanChoice = selectedFamilySlug === "palan" && !selectedType;

  return (
    <main className="bg-slate-50 text-slate-950">
      <section className="border-b border-slate-200 bg-white py-9 sm:py-11">
        <Container>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-600">{page.fields.content001}</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">{selectedFamily?.title || content.title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{selectedFamily ? selectedFamily.description || `Découvrez les équipements ${selectedFamily.title.toLowerCase()} disponibles.` : content.description}</p>
        </Container>
      </section>

      {!selectedFamilySlug ? <section className="py-10"><Container><IndustrialFamilyNavigation categorySlug="levage" title={page.fields.content002} families={subFamilies} familyCounts={familyCounts} /></Container></section> : null}

      {showPalanChoice ? (
        <section className="bg-white py-10"><Container>
          <div className="mb-6 flex items-end justify-between gap-4"><div><h2 className="text-2xl font-black">{page.fields.content003}</h2><p className="mt-2 text-sm text-slate-600">{page.fields.content004}</p></div><Link href={page.fields.content005} className="text-sm font-black text-[#007f8f]">{page.fields.content006}</Link></div>
          <div className="grid gap-4 md:grid-cols-3">{palanTypes.map((item) => <a key={item.id} href={`/catalogue/levage?famille=palan&type=${item.id}`} className="group overflow-hidden rounded-2xl border border-slate-200 transition hover:border-orange-400 hover:shadow-lg"><div className="aspect-[16/9] bg-slate-50"><img src={getProductImageUrl(item.image)} alt={page.fields.content007} className="h-full w-full object-contain p-4" /></div><div className="p-4"><h3 className="font-black">{item.title}</h3><span className="mt-2 inline-flex items-center gap-2 text-sm font-black text-orange-600">{page.fields.content008}<ArrowRight size={16} /></span></div></a>)}</div>
        </Container></section>
      ) : null}

      {selectedFamilySlug && !showPalanChoice ? (
        <section className="bg-white py-10"><Container>
          <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 className="text-2xl font-black">{selectedType ? palanTypes.find((item) => item.id === selectedType)?.title : selectedFamily?.title}</h2><p className="mt-2 text-sm text-slate-600">{page.fields.content009}</p></div><a href={selectedFamilySlug === "palan" ? "/catalogue/levage?famille=palan" : "/catalogue/levage"} className="text-sm font-black text-[#007f8f]">{page.fields.content010}</a></div>
          {products.length ? <CatalogProductGrid products={products.slice(0, 24)} /> : <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6 text-sm font-bold text-orange-800">{page.fields.content011}</div>}
        </Container></section>
      ) : null}
    </main>
  );
}

export async function generateMetadata(){const category=await getPublicCategory("levage");return {title:category?.seoTitle || category?.publicLabel || category?.name,description:category?.seoDescription || category?.description || undefined};}
