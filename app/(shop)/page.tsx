import {
  getPublicPresentation,
  visibleHome,
} from "@/lib/catalogue/public-presentation";
import { ArrowRight, SlidersHorizontal, Ruler, PackageCheck, ShoppingCart, Settings2, Weight } from "lucide-react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import HomeHeroCarousel from "@/components/home/HomeHeroCarousel";
import HomeCategoryRows, {
  type HomeCategoryRow,
} from "@/components/home/HomeCategoryRows";
import HomeSupplierMarquee from "@/components/home/HomeSupplierMarquee";
import { orderedVisible } from "@/lib/cms-content";
import { getCmsContent } from "@/lib/cms";
import { getProductImageUrl } from "@/lib/product-images";
import {
  catalogueSubFamilies,
  filterProductsByFamily,
  getProductCardImages,
  getProductsByCategoryAndFamily,
} from "@/lib/catalogue/repository";
import { getDatabaseProductsByCategory } from "@/lib/catalogue/database-repository";
import { prisma } from "@/lib/db/prisma";

// Visuels éditoriaux dédiés aux cinq univers de la page d’accueil.
const homeUniverseImages: Record<string, string> = {
  levage: "/images/home-categories/levage-atelier.jpg",
  manutention: "/images/home-categories/manutention.webp",
  "motorisation-sew": "/images/home-categories/motorisation-sew.webp",
  stockage: "/images/home-categories/stockage.webp",
  "acces-hauteur": "/images/home-categories/acces-hauteur.webp",
};

export default async function HomePage() {
  const { home } = await getCmsContent();
  const heroCategoryLinks = orderedVisible(home.quickLinks).filter((item) => !/stockage|acc[eè]s.hauteur/i.test(item.label));
  // Textes commerciaux validés : images existantes du CMS conservées.
  const existingSlides = orderedVisible(home.slides);
  const commercialSlides = [
    { label: "Levage", title: "Potence de levage", text: "Découvrez nos différentes gammes de potences pour atelier.", href: "/catalogue/levage?famille=potences", ctaLabel: "Voir les potences" },
    { label: "Levage", title: "Palan manuel ou électrique", text: "Découvrez nos différentes gammes de chariots et palans.", href: "/catalogue/levage?famille=palan", ctaLabel: "Voir les palans" },
    { label: "Manutention", title: "Équipez vos flux et vos postes en appareils de manutention", text: "Transpalettes, gerbeurs, tables élévatrices et équipements d’atelier.", href: "/catalogue/manutention-au-sol", ctaLabel: "Voir la manutention" },
  ];
  const slides = commercialSlides.map((item, index) => ({
    ...item, image: existingSlides[index]?.image || home.heroImage,
    images: index === 0 ? ["/media/photos/ADEI/PFI2502000.webp", "/media/photos/ADEI/PFT2502000.webp", "/media/photos/ADEI/PMI2502000.webp"] : index === 1 ? [getProductImageUrl("ER2M010ILIS"), getProductImageUrl("CB010"), getProductImageUrl("TSG1000B")] : undefined,
  }));
  const { categories, suppliers } = await getPublicPresentation();
  // Reuse real, published Stockman product media for the two homepage family cards.
  const familyPhotoProducts = await prisma.product.findMany({
    where: { code: { in: ["LP", "UPLIFT5"] }, publicationStatus: "PUBLISHED" },
    select: { code: true, media: { where: { type: "IMAGE" }, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true } } },
  }).catch(() => []);
  const stockmanFamilyImages = new Map(familyPhotoProducts.map(product => [product.code.toUpperCase(), product.media[0]?.url]));
  const categoryRows = visibleHome(
    categories.filter((item) => !item.homeParentId),
  ).filter((category) => !["stockage", "stockage-emballage", "acces-hauteur"].includes(category.slug)).map((category) => ({
    slug: category.slug,
    title: category.homeLabel || category.publicLabel || category.name,
    href: category.publicHref || `/catalogue/${category.slug}`,
    imageUrl: /manutention/i.test(
      category.homeLabel || category.publicLabel || category.name,
    )
      ? "/images/home-categories/manutention.webp"
      : /stockage/i.test(
            category.homeLabel || category.publicLabel || category.name,
          )
        ? "/images/home-categories/stockage.webp"
        : homeUniverseImages[category.slug] ||
          category.homeImageUrl ||
          category.imageUrl ||
          "",
    children: visibleHome(
      categories.filter((item) => item.homeParentId === category.id),
    ).filter((family) => !/élévateur de charge|elevateur de charge/i.test(family.homeLabel || family.publicLabel || family.name)).map((family) => ({
      title: family.homeLabel || family.publicLabel || family.name,
      href:
        family.publicHref ||
        `/catalogue/${category.slug}?famille=${family.publicFamilySlug || family.slug}`,
      imageUrl: /élévateur de charge|elevateur de charge/i.test(
        family.homeLabel || family.publicLabel || family.name,
      )
        ? stockmanFamilyImages.get("LP") || "https://www.stockman.fr/fr/upload/products_data/images/medium/elevateur-leve-charge-manuel-climatiseur-stockman_LP125.jpg"
        : /nacelle/i.test(family.homeLabel || family.publicLabel || family.name)
          ? stockmanFamilyImages.get("UPLIFT5") || family.homeImageUrl || family.imageUrl || undefined
          : family.homeImageUrl || family.imageUrl || undefined,
    })),
  }));

  return (
    <main className="bg-white text-slate-950">
      {home.heroEnabled && (
        <section className="overflow-hidden bg-gradient-to-br from-white via-slate-50 to-slate-100">
          <Container className="grid min-h-[340px] items-center gap-7 py-5 lg:grid-cols-[0.88fr_1.12fr]">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-black leading-[1.01] tracking-tight md:text-[2.85rem] xl:text-[3.35rem]">
                {home.heroTitle}
                <span className="block text-[#007f8f]">{home.heroAccent}</span>
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-700 md:text-base">
                {home.heroText}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-black md:text-sm">
                {heroCategoryLinks.map((item, index) => (
                  <span key={item.label} className="flex items-center gap-2">
                    <a
                      href={item.href}
                      className="transition hover:text-[#007f8f] hover:underline"
                    >
                      {item.label}
                    </a>
                    {index < heroCategoryLinks.length - 1 ? (
                      <span className="text-orange-600">•</span>
                    ) : null}
                  </span>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button href="/catalogue" className="px-5 py-3 text-sm">
                  {home.primaryLabel} <ArrowRight size={17} />
                </Button>
                <Button
                  href="/configurateur"
                  variant="primary"
                  className="px-6 py-3 text-sm ring-2 ring-[#007f8f] ring-offset-2"
                >
                  {home.secondaryLabel} <SlidersHorizontal size={17} />
                </Button>
              </div>
            </div>
            <HomeHeroCarousel slides={slides} />
          </Container>
        </section>
      )}

      <section className="py-8 sm:py-10">
        <Container>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-600">
                {home.categoryEyebrow}
              </p>
              <h2 className="mt-2 text-3xl font-black">{home.categoryTitle}</h2>
            </div>
            <Link
              href={home.catalogueHref}
              className="text-sm font-black text-[#007f8f]"
            >
              {home.catalogueLabel}
            </Link>
          </div>
          <HomeCategoryRows rows={categoryRows} />
        </Container>
      </section>

      <section className="pb-10 sm:pb-12" aria-labelledby="configurator-promo-title">
        <Container>
          <div className="relative isolate overflow-hidden rounded-3xl border border-cyan-100 bg-gradient-to-br from-white via-cyan-50 to-cyan-200 p-5 shadow-lg sm:p-7">
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-12 -z-10 h-40 w-[70%] rotate-6 rounded-[100%] bg-[#007f8f]/20" />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#007f8f]">Votre potence sur mesure</p>
                <h2 id="configurator-promo-title" className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Configurez votre <span className="text-orange-600">potence de levage</span></h2>
                <p className="mt-1 text-sm text-slate-700">Du choix du type à l’ajout au panier, composez votre solution en quelques étapes.</p>
              </div>
              <Link href="/configurateur" className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-5 py-3 text-sm font-black text-white hover:bg-orange-700">Configurer ma potence <ArrowRight size={17}/></Link>
            </div>
            <div className="mx-auto mt-3 h-1 w-12 rounded-full bg-orange-500" />
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5 xl:gap-5">
              {[
                {title: "Type de potence", content: <div className="grid gap-2"><div className="flex h-[82px] items-center gap-2 rounded-lg border border-[#007f8f]/40 bg-cyan-50 p-2"><img src="/media/photos/ADEI/PFI2502000.webp" alt="Potence sur fût" className="h-full w-[58%] object-contain mix-blend-multiply"/><span className="text-xs font-black">Sur fût</span></div><div className="flex h-[82px] items-center gap-2 rounded-lg border border-slate-200 p-2"><img src="/media/photos/ADEI/PMI2502000.webp" alt="Potence murale" className="h-full w-[58%] object-contain"/><span className="text-xs font-black">Murale</span></div></div>},
                {title: "Capacité", content: <div><div className="grid gap-1">{["150 kg", "250 kg", "500 kg", "1 tonne", "2 tonnes"].map((capacity, i) => <div key={capacity} className={`flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-bold ${i === 0 ? "bg-cyan-100" : "bg-white"}`}><Weight size={12} className="text-[#007f8f]"/>{capacity}<span className={`ml-auto h-2.5 w-2.5 rounded-full border ${i === 0 ? "border-[#007f8f] bg-[#007f8f]" : "border-slate-300"}`}/></div>)}</div><img src="/media/photos/ADEI/PFI2502000.webp" alt="Exemple de potence" className="mt-1 h-[64px] w-full object-contain"/></div>},
                {title: "Dimensions", content: <div><div className="relative h-[135px] overflow-hidden rounded-lg bg-slate-50"><img src="/media/photos/ADEI/PFI2502000.webp" alt="Potence : portée et hauteur sous fer" className="absolute inset-x-0 bottom-1 h-[105px] w-full object-contain mix-blend-multiply"/><div className="absolute inset-x-5 top-1 text-center text-[10px] font-bold text-[#007f8f]">Portée<div className="flex items-center"><span>◀</span><span className="flex-1 border-t border-dashed border-[#007f8f]"/><span>▶</span></div></div><div className="absolute left-1 top-9 flex h-[84px] items-center gap-1 text-[9px] font-bold text-[#007f8f]"><div className="flex h-full flex-col items-center"><span>▲</span><span className="flex-1 border-l border-dashed border-[#007f8f]"/><span>▼</span></div><span className="rounded bg-cyan-50 p-1 leading-tight">Hauteur<br/>sous fer</span></div></div><div className="mt-2 grid gap-1 text-[11px] font-bold"><div className="flex justify-between rounded border border-slate-200 px-2 py-1">Portée <span className="text-slate-500">À définir</span></div><div className="flex justify-between rounded border border-slate-200 px-2 py-1">Hauteur <span className="text-slate-500">À définir</span></div></div></div>},
                {title: "Chariot et palan", content: <div><div className="grid gap-1 text-[11px] font-bold"><div className="rounded border border-slate-200 px-2 py-1">Chariot <span className="float-right text-slate-500">↔</span></div><div className="rounded border border-slate-200 px-2 py-1">Palan électrique ou manuel</div></div><div className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-white">{[{src:"/images/configurator/palan-electrique.jpg",label:"Électrique"},{src:"/images/configurator/palan-manuel.jpg",label:"Manuel"}].map(palan => <div key={palan.src} className="min-w-0 rounded-lg border border-slate-200 bg-white p-2"><img src={palan.src} alt={`Palan ${palan.label.toLowerCase()}`} className="h-[108px] w-full object-contain"/><p className="mt-1 text-center text-[11px] font-bold text-slate-700">{palan.label}</p></div>)}</div></div>},
                {title: "Panier", content: <div className="rounded-lg bg-slate-50 p-2"><div className="flex items-center gap-1 text-xs font-black"><PackageCheck size={15} className="text-[#007f8f]"/> Récapitulatif</div><div className="mt-2 space-y-2 text-[11px] text-slate-700"><p className="font-bold">Votre potence</p><p className="flex items-center gap-1"><Weight size={13}/> Charge choisie</p><p className="flex items-center gap-1"><Ruler size={13}/> Dimensions</p><p className="flex items-center gap-1"><Settings2 size={13}/> Équipements</p></div><div className="mt-3 rounded-md bg-slate-950 px-2 py-2 text-center text-xs font-black text-white">Votre prix HT</div><Link href="/configurateur" className="mt-2 flex items-center justify-center gap-1 rounded-md bg-orange-600 px-2 py-2 text-[11px] font-black text-white"><ShoppingCart size={13}/> Configurer</Link></div>},
              ].map((step, index) => <article key={step.title} className="relative min-w-0 rounded-xl border border-white bg-white/95 p-3 shadow-md shadow-cyan-900/10"><div className="mb-3 flex items-center gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-600 text-xs font-black text-white">{index+1}</span><h3 className="text-sm font-black leading-tight">{step.title}</h3></div>{step.content}{index < 4 && <ArrowRight aria-hidden="true" size={17} className="absolute -right-[19px] top-1/2 z-10 hidden -translate-y-1/2 text-orange-600 xl:block"/>}</article>)}
            </div>
            <p className="mt-3 text-center text-[10px] text-slate-600">Aperçu du parcours de configuration. Les options disponibles dépendent du modèle choisi.</p>
          </div>
        </Container>
      </section>

      <section className="pb-10 sm:pb-12">
        <Container>
          <div className="mb-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-600">
              {home.supplierEyebrow}
            </p>
            <h2 className="mt-2 text-3xl font-black">{home.supplierTitle}</h2>
          </div>
          <HomeSupplierMarquee suppliers={visibleHome(suppliers)} />
        </Container>
      </section>
    </main>
  );
}
