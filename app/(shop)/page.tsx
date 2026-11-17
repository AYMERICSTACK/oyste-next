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
  levage: "/images/home-categories/levage.webp",
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
    { label: "Levage", title: "Potence de levage", text: "Découvrez nos différentes gammes de potences pour atelier.", href: "/catalogue/levage?famille=potence-sur-fut", ctaLabel: "Voir les potences" },
    { label: "Levage", title: "Palan manuel ou électrique", text: "Découvrez nos différentes gammes de chariots et palans.", href: "/catalogue/levage?famille=palan", ctaLabel: "Voir les palans" },
    { label: "Manutention", title: "Équipez vos flux et vos postes en appareils de manutention", text: "Transpalettes, gerbeurs, tables élévatrices et équipements d’atelier.", href: "/catalogue/manutention-au-sol", ctaLabel: "Voir la manutention" },
  ];
  const slides = commercialSlides.map((item, index) => ({
    ...item, image: existingSlides[index]?.image || home.heroImage,
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
          <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-[#005f70] via-[#007f8f] to-[#0b5965] px-6 py-8 text-white shadow-lg sm:px-9">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-300">Votre potence sur mesure</p>
                <h2 id="configurator-promo-title" className="mt-2 text-2xl font-black sm:text-3xl">Configurez votre potence de levage</h2>
                <p className="mt-2 max-w-2xl text-sm text-white/90">Du choix du modèle jusqu’au panier, créez votre solution en quelques étapes.</p>
              </div>
              <Link href="/configurateur" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-4 text-sm font-black uppercase text-white shadow-lg transition hover:bg-orange-700">Configurer ma potence <ArrowRight size={18} /></Link>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { title: "Type de potence", description: "Sur fût ou murale", Icon: Settings2 },
                { title: "Capacité", description: "Choisissez la charge", Icon: Weight },
                { title: "Dimensions", description: "Portée et hauteur", Icon: Ruler },
                { title: "Équipements", description: "Chariot et palan", Icon: PackageCheck },
                { title: "Panier", description: "Vérifiez et ajoutez", Icon: ShoppingCart },
              ].map((step, index) => <div key={step.title} className="rounded-xl bg-white p-4 text-slate-900 shadow-sm">
                <div className="flex items-center justify-between"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-600 text-xs font-black text-white">{index + 1}</span><step.Icon size={23} className="text-[#007f8f]" /></div>
                <h3 className="mt-3 text-sm font-black">{step.title}</h3><p className="mt-1 text-xs text-slate-600">{step.description}</p>
              </div>)}
            </div>
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
