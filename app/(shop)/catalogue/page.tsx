import { Fragment } from "react";
import { getEditorialPage, editorialIcon } from "@/lib/editorial";
import { Boxes } from "lucide-react";
import { getPublicPresentation } from "@/lib/catalogue/public-presentation";
import CategoryCard from "@/components/catalogue/CategoryCard";
import SearchBar from "@/components/catalogue/SearchBar";
import Container from "@/components/ui/Container";
import { catalogueUniverses } from "@/data/catalogue";

export default async function CataloguePage() {
 const page = await getEditorialPage("catalogue");

  const { categories } = await getPublicPresentation();
  const roots = categories.filter(category => !category.homeParentId && category.isActive && category.catalogueVisible).sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <main className="bg-slate-50 text-slate-950">{page.collections.pageSections.filter(block=>block.enabled).sort((a,b)=>a.order-b.order).map(block=><Fragment key={block.id}>{({"section1":(<section className="border-b border-slate-200 bg-white py-10 sm:py-12">
        <Container>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-600">{page.fields.content001}</p>
          <div className="mt-2 grid gap-6 lg:grid-cols-[1fr_520px] lg:items-end">
            <div><h1 className="text-4xl font-black">{page.fields.content002}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{page.fields.content003}</p></div>
            <SearchBar />
          </div>
        </Container>
      </section>),
"section2":(<section className="py-10 sm:py-12">
        <Container><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{roots.map(category => { const legacy = catalogueUniverses.find(item => item.slug === category.slug); return <CategoryCard key={category.slug} slug={category.slug} title={category.publicLabel || category.name} subtitle={category.publicSubtitle || ""} countLabel="" description={category.description || ""} icon={legacy?.icon || Boxes} accent={legacy?.accent || "bg-[#007f8f]"} href={category.publicHref || `/catalogue/${category.slug}`} mode={legacy?.mode || "catalogue"} tags={category.publicTags} imageUrl={category.imageUrl} />; })}</div></Container>
      </section>)} as Record<string,React.ReactNode>)[block.id]}</Fragment>)}</main>
  );
}
