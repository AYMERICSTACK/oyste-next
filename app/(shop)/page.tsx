import { getPublicPresentation, visibleHome } from "@/lib/catalogue/public-presentation";
import { ArrowRight, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import HomeHeroCarousel from "@/components/home/HomeHeroCarousel";
import HomeCategoryRows, { type HomeCategoryRow } from "@/components/home/HomeCategoryRows";
import HomeSupplierMarquee from "@/components/home/HomeSupplierMarquee";
import { orderedVisible } from "@/lib/cms-content";
import { getCmsContent } from "@/lib/cms";
import { getProductImageUrl } from "@/lib/product-images";
import { catalogueSubFamilies, filterProductsByFamily, getProductCardImages, getProductsByCategoryAndFamily } from "@/lib/catalogue/repository";
import { getDatabaseProductsByCategory } from "@/lib/catalogue/database-repository";

export default async function HomePage() {
  const { home } = await getCmsContent();
  const heroCategoryLinks = orderedVisible(home.quickLinks);
  const slides = orderedVisible(home.slides);
  const { categories, suppliers } = await getPublicPresentation();
  const categoryRows = visibleHome(categories.filter(item => !item.homeParentId)).map(category => ({
    slug: category.slug, title: category.homeLabel || category.publicLabel || category.name,
    href: category.publicHref || `/catalogue/${category.slug}`,
    imageUrl: category.homeImageUrl || category.imageUrl || "",
    children: visibleHome(categories.filter(item => item.homeParentId === category.id)).map(family => ({
      title: family.homeLabel || family.publicLabel || family.name, href: family.publicHref || `/catalogue/${category.slug}?famille=${family.publicFamilySlug || family.slug}`, imageUrl: family.homeImageUrl || family.imageUrl || undefined,
    })),
  }));

  return (
    <main className="bg-white text-slate-950">
      {home.heroEnabled && <section className="overflow-hidden bg-gradient-to-br from-white via-slate-50 to-slate-100">
        <Container className="grid min-h-[340px] items-center gap-7 py-5 lg:grid-cols-[0.88fr_1.12fr]">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-black leading-[1.01] tracking-tight md:text-[2.85rem] xl:text-[3.35rem]">{home.heroTitle}<span className="block text-[#007f8f]">{home.heroAccent}</span></h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-700 md:text-base">{home.heroText}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-black md:text-sm">
              {heroCategoryLinks.map((item, index) => <span key={item.label} className="flex items-center gap-2"><a href={item.href} className="transition hover:text-[#007f8f] hover:underline">{item.label}</a>{index < heroCategoryLinks.length - 1 ? <span className="text-orange-600">•</span> : null}</span>)}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button href={home.primaryHref} className="px-5 py-3 text-sm">{home.primaryLabel} <ArrowRight size={17} /></Button>
              <Button href={home.secondaryHref} variant="secondary" className="px-5 py-3 text-sm">{home.secondaryLabel} <SlidersHorizontal size={17} /></Button>
            </div>
          </div>
          <HomeHeroCarousel slides={slides} />
        </Container>
      </section>}

      <section className="py-8 sm:py-10">
        <Container>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[0.22em] text-orange-600">{home.categoryEyebrow}</p><h2 className="mt-2 text-3xl font-black">{home.categoryTitle}</h2></div><Link href={home.catalogueHref} className="text-sm font-black text-[#007f8f]">{home.catalogueLabel}</Link></div>
          <HomeCategoryRows rows={categoryRows} />
        </Container>
      </section>

      <section className="pb-10 sm:pb-12">
        <Container>
          <div className="mb-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-600">{home.supplierEyebrow}</p>
            <h2 className="mt-2 text-3xl font-black">{home.supplierTitle}</h2>
          </div>
          <HomeSupplierMarquee suppliers={visibleHome(suppliers)} />
        </Container>
      </section>
    </main>
  );
}
