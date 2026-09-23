import { ArrowRight, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import HomeHeroCarousel, { type HomeHeroSlide } from "@/components/home/HomeHeroCarousel";
import HomeCategoryRows, { type HomeCategoryRow } from "@/components/home/HomeCategoryRows";
import { getCmsContent } from "@/lib/cms";
import { getProductImageUrl } from "@/lib/product-images";
import { catalogueSubFamilies, getProductMediaImages, getProductsByCategoryAndFamily } from "@/lib/catalogue/repository";

const heroCategoryLinks = [
  { label: "Potences", href: "/configurateur" },
  { label: "Palans", href: "/catalogue/levage?famille=palan" },
  { label: "Portiques", href: "/catalogue/levage?famille=portique" },
  { label: "Motorisation SEW", href: "/catalogue/motorisation-sew" },
  { label: "Manutention", href: "/catalogue/manutention-au-sol" },
];

const homeCategories = [
  ["levage", "Levage", "/catalogue/levage", "PFI2502000"],
  ["manutention-au-sol", "Manutention", "/catalogue/manutention-au-sol", "ACPREMIUM"],
  ["motorisation-sew", "Motorisation SEW", "/catalogue/motorisation-sew", "MOTEUR"],
  ["stockage-emballage", "Stockage", "/catalogue/stockage-emballage", "KITTE"],
  ["acces-hauteur", "Accès hauteur", "/catalogue/acces-hauteur", "ES2M"],
] as const;

function familyTarget(href: string) {
  const match = href.match(/^\/catalogue\/([^?]+).*?[?&]famille=([^&]+)/);
  return match ? { categorySlug: match[1], familySlug: match[2] } : null;
}

export default async function HomePage() {
  const { home } = await getCmsContent();
  const slides: HomeHeroSlide[] = [
    { label: "Levage", title: "Potences configurées pour votre atelier", text: "Définissez la charge, la portée, la fixation et les options adaptées à votre besoin.", href: "/configurateur", image: getProductImageUrl("PFI2502000") },
    { label: "Palans", title: "Levage manuel ou électrique", text: "Choisissez votre technologie, votre capacité et les paramètres utiles à l’installation.", href: "/catalogue/levage?famille=palan", image: getProductImageUrl("CB010") },
    { label: "Manutention", title: "Équipez vos flux et vos postes", text: "Transpalettes, gerbeurs, tables élévatrices et équipements d’atelier.", href: "/catalogue/manutention-au-sol", image: getProductImageUrl("ACPREMIUM") },
  ];
  const categoryRows: HomeCategoryRow[] = homeCategories.map(([slug, title, href, imageRef]) => ({
    slug,
    title,
    href,
    imageUrl: getProductImageUrl(imageRef),
    children: (catalogueSubFamilies[slug] || []).map((family) => {
      const target = familyTarget(family.href);
      const representative = target ? getProductsByCategoryAndFamily(target.categorySlug, target.familySlug)[0] : undefined;
      return { title: family.title, href: family.href, imageUrl: representative ? getProductMediaImages(representative)[0] || getProductImageUrl(representative.imageRef, representative.code, representative.parentCode) : undefined };
    }),
  }));

  return (
    <main className="bg-white text-slate-950">
      <section className="overflow-hidden bg-gradient-to-br from-white via-slate-50 to-slate-100">
        <Container className="grid min-h-[340px] items-center gap-7 py-5 lg:grid-cols-[0.88fr_1.12fr]">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-black leading-[1.01] tracking-tight md:text-[2.85rem] xl:text-[3.35rem]">{home.heroTitle}<span className="block text-[#007f8f]">{home.heroAccent}</span></h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-700 md:text-base">{home.heroText}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-black md:text-sm">
              {heroCategoryLinks.map((item, index) => <span key={item.label} className="flex items-center gap-2"><a href={item.href} className="transition hover:text-[#007f8f] hover:underline">{item.label}</a>{index < heroCategoryLinks.length - 1 ? <span className="text-orange-600">•</span> : null}</span>)}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button href={home.primaryHref} className="px-5 py-3 text-sm">{home.primaryLabel} <ArrowRight size={17} /></Button>
              <Button href="/configurateur" variant="secondary" className="px-5 py-3 text-sm">Configurer ma potence <SlidersHorizontal size={17} /></Button>
            </div>
          </div>
          <HomeHeroCarousel slides={slides} />
        </Container>
      </section>

      <section className="py-8 sm:py-10">
        <Container>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[0.22em] text-orange-600">Nos catégories</p><h2 className="mt-2 text-3xl font-black">L’essentiel de l’équipement industriel</h2></div><Link href="/catalogue" className="text-sm font-black text-[#007f8f]">Voir tout le catalogue →</Link></div>
          <HomeCategoryRows rows={categoryRows} />
        </Container>
      </section>
    </main>
  );
}
