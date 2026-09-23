import { ArrowRight } from "lucide-react";
import Link from "next/link";
import CatalogProductGrid from "@/components/catalogue/CatalogProductGrid";
import IndustrialFamilyNavigation from "@/components/catalogue/IndustrialFamilyNavigation";
import Container from "@/components/ui/Container";
import { catalogueCategoryContent, catalogueSubFamilies, getSubFamilyBySlug, filterProductsByFamily } from "@/lib/catalogue/repository";
import { getDatabaseProductsByCategory } from "@/lib/catalogue/database-repository";
import { getProductImageUrl } from "@/lib/product-images";

const palanTypes = [
  { id: "electrique", title: "Palan électrique", text: "Pour les usages motorisés et les cycles de levage réguliers.", image: "ER2M001HL" },
  { id: "manuel", title: "Palan manuel", text: "Solutions à chaîne ou à levier pour les opérations manuelles.", image: "CB010" },
  { id: "chariot", title: "Chariot porte-palan manuel", text: "Pour le déplacement du palan sur le profil de roulement.", image: "TSG010" },
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
  const query = await searchParams;
  const selectedFamilySlug = query?.famille;
  const selectedType = query?.type;
  const content = catalogueCategoryContent.levage;
  const subFamilies = catalogueSubFamilies.levage;
  const selectedFamily = selectedFamilySlug ? getSubFamilyBySlug("levage", selectedFamilySlug) : undefined;
  const categoryProducts = await getDatabaseProductsByCategory("levage");
  const familyProducts = selectedFamilySlug ? filterProductsByFamily(categoryProducts, selectedFamilySlug) : [];
  const products = familyProducts.filter((product) => matchesPalanType(product, selectedFamilySlug === "palan" ? selectedType : undefined));
  const familyCounts = Object.fromEntries(subFamilies.map((family) => {
    const slug = family.href.split("famille=")[1] || "";
    return [slug, slug ? filterProductsByFamily(categoryProducts, slug).length : 0];
  }));
  const showPalanChoice = selectedFamilySlug === "palan" && !selectedType;

  return (
    <main className="bg-slate-50 text-slate-950">
      <section className="border-b border-slate-200 bg-white py-9 sm:py-11">
        <Container>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-600">Levage professionnel</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">{selectedFamily?.title || content.title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{selectedFamily ? `Découvrez les équipements ${selectedFamily.title.toLowerCase()} disponibles.` : content.description}</p>
        </Container>
      </section>

      {!selectedFamilySlug ? <section className="py-10"><Container><IndustrialFamilyNavigation categorySlug="levage" title="Catégories de levage" families={subFamilies} familyCounts={familyCounts} /></Container></section> : null}

      {showPalanChoice ? (
        <section className="bg-white py-10"><Container>
          <div className="mb-6 flex items-end justify-between gap-4"><div><h2 className="text-2xl font-black">Quel type de palan recherchez-vous ?</h2><p className="mt-2 text-sm text-slate-600">Choisissez d’abord le mode de levage ou le chariot adapté.</p></div><Link href="/catalogue/levage" className="text-sm font-black text-[#007f8f]">Toutes les catégories</Link></div>
          <div className="grid gap-4 md:grid-cols-3">{palanTypes.map((item) => <a key={item.id} href={`/catalogue/levage?famille=palan&type=${item.id}`} className="group overflow-hidden rounded-2xl border border-slate-200 transition hover:border-orange-400 hover:shadow-lg"><div className="aspect-[16/9] bg-slate-50"><img src={getProductImageUrl(item.image)} alt="" className="h-full w-full object-contain p-4" /></div><div className="p-4"><h3 className="font-black">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p><span className="mt-3 inline-flex items-center gap-2 text-sm font-black text-orange-600">Voir les produits <ArrowRight size={16} /></span></div></a>)}</div>
        </Container></section>
      ) : null}

      {selectedFamilySlug && !showPalanChoice ? (
        <section className="bg-white py-10"><Container>
          <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 className="text-2xl font-black">{selectedType ? palanTypes.find((item) => item.id === selectedType)?.title : selectedFamily?.title}</h2><p className="mt-2 text-sm text-slate-600">Sélectionnez un produit pour consulter ses caractéristiques et ses options.</p></div><a href={selectedFamilySlug === "palan" ? "/catalogue/levage?famille=palan" : "/catalogue/levage"} className="text-sm font-black text-[#007f8f]">← Retour aux catégories</a></div>
          {products.length ? <CatalogProductGrid products={products.slice(0, 24)} /> : <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6 text-sm font-bold text-orange-800">Aucun produit disponible dans cette sélection.</div>}
        </Container></section>
      ) : null}
    </main>
  );
}
