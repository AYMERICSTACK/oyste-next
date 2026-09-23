import { type LucideIcon } from "lucide-react";
import Container from "@/components/ui/Container";
import SectionHeader from "@/components/ui/SectionHeader";
import PremiumCatalog, { type PremiumCatalogItem } from "@/components/catalogue/PremiumCatalog";
import IndustrialFamilyNavigation from "@/components/catalogue/IndustrialFamilyNavigation";
import { catalogueUniverses } from "@/data/catalogue";
import {
  catalogueCategoryContent,
  catalogueSubFamilies,
  getCatalogCategory,
  formatCategoryLabel,
  formatPriceRange,
  getCustomerProductDescription,
  getProductAvailableDocumentCount,
  getProductExperienceType,
  getProductMarketingBadges,
  getProductMediaImages,
  getSubFamilyBySlug,
  filterProductsByFamily,
  isPotenceProduct,
} from "@/lib/catalogue/repository";
import { getDatabaseProductsByCategory } from "@/lib/catalogue/database-repository";
import { notFound } from "next/navigation";


function extractCapacity(product: { features?: Array<{ label: string; value: string }>; name: string; description: string }) {
  const feature = product.features?.find((item) => /cmu|capacit|charge/i.test(item.label));
  const source = feature?.value || `${product.name} ${product.description}`;
  const tonne = source.match(/(\d+(?:[.,]\d+)?)\s*t(?:onne)?s?\b/i);
  if (tonne) {
    const value = Number(tonne[1].replace(",", ".")) * 1000;
    return { label: `${value.toLocaleString("fr-FR")} kg`, value };
  }
  const kg = source.match(/(\d[\d\s]*(?:[.,]\d+)?)\s*kg\b/i);
  if (kg) {
    const value = Number(kg[1].replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(value) ? { label: `${value.toLocaleString("fr-FR")} kg`, value } : { label: "Non renseignée", value: null };
  }
  return { label: "Non renseignée", value: null };
}

function getProductTypeLabel(product: { name: string; description: string; features?: Array<{ label: string; value: string }> }, configurable: boolean) {
  if (configurable) return "Configurable";
  const source = `${product.name} ${product.description} ${(product.features || []).map((item) => `${item.label} ${item.value}`).join(" ")}`;
  if (/électrique|electrique|motorisé|motorise/i.test(source)) return "Électrique";
  if (/manuel|manuelle/i.test(source)) return "Manuel";
  return "Standard";
}

export function generateStaticParams() {
  return catalogueUniverses
    .filter((item) => item.slug !== "levage")
    .map((item) => ({ slug: item.slug }));
}

export default async function CatalogueUniversePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ famille?: string }>;
}) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const selectedFamilySlug = resolvedSearchParams?.famille;
  const universe = catalogueUniverses.find(
    (item) => item.slug === slug || item.href.endsWith(slug),
  );
  const category = getCatalogCategory(slug);

  if (!universe || !category) notFound();

  const Icon: LucideIcon = universe.icon as LucideIcon;
  const content = catalogueCategoryContent[slug];
  const subFamilies = catalogueSubFamilies[slug] || [];
  const selectedFamily = selectedFamilySlug
    ? getSubFamilyBySlug(slug, selectedFamilySlug)
    : undefined;
  const categoryProducts = await getDatabaseProductsByCategory(slug);
  const products = selectedFamilySlug
    ? filterProductsByFamily(categoryProducts, selectedFamilySlug)
    : [];
  const familyCounts = Object.fromEntries(
    subFamilies.map((family) => {
      const familySlug = family.href.split("famille=")[1] || "";
      return [familySlug, familySlug ? filterProductsByFamily(categoryProducts, familySlug).length : 0];
    }),
  );
  const premiumProducts: PremiumCatalogItem[] = products.map((product) => {
    const isConfigurable = getProductExperienceType(product) === "CONFIGURABLE" || isPotenceProduct(product);
    const capacity = extractCapacity(product);
    const marketingBadges = getProductMarketingBadges(product);
    return {
      id: product.id,
      code: product.code,
      name: product.name,
      family: formatCategoryLabel(product.categoryPath),
      description: getCustomerProductDescription(product),
      href: product.href,
      imageUrl: getProductMediaImages(product)[0] || "",
      priceLabel: isConfigurable ? "Configuration sur mesure" : formatPriceRange(product),
      minPriceHT: product.minPriceHT ?? product.priceHT ?? null,
      badge: marketingBadges[0] || "Catalogue OYSTE",
      badges: marketingBadges,
      documentCount: getProductAvailableDocumentCount(product),
      variantCount: product.variantCount || product.variants?.length || 1,
      experienceType: isConfigurable ? "CONFIGURABLE" : "STANDARD",
      stock: product.stock,
      delay: product.delay,
      manufacturer: product.manufacturer || "Non renseigné",
      capacityLabel: capacity.label,
      capacityKg: capacity.value,
      productType: getProductTypeLabel(product, isConfigurable),
    };
  });
  const isFamilyView = Boolean(selectedFamilySlug);

  return (
    <main className="bg-slate-50 text-slate-950">
      <section className="border-b border-slate-200 bg-white py-9 sm:py-11">
        <Container className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <SectionHeader
            eyebrow="Équipements professionnels"
            title={selectedFamily?.title || content?.title || universe.title}
            text={
              selectedFamily
                ? `Découvrez les équipements ${selectedFamily.title.toLowerCase()} disponibles.`
                : content?.description ||
                  category.description ||
                  universe.description
            }
          />

          <div className="hidden h-16 w-16 items-center justify-center rounded-2xl bg-[#007f8f]/10 text-[#005466] sm:flex"><Icon size={30} strokeWidth={1.6} /></div>
        </Container>
      </section>

      {!isFamilyView && subFamilies.length > 0 ? (
        <section className="py-10">
          <Container>
            <IndustrialFamilyNavigation
              categorySlug={slug}
              title={`Catégories ${content?.title || universe.title}`}
              families={subFamilies}
              familyCounts={familyCounts}
            />
          </Container>
        </section>
      ) : null}

      {isFamilyView ? (
        <section className="bg-white py-10">
          <Container>
            <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-600">
                  Produits de la catégorie
                </p>
                <h2 className="mt-2 text-3xl font-black text-slate-950">
                  {selectedFamily?.title || "Catégorie"}
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                  Sélectionnez un produit pour consulter ses caractéristiques et ses options.
                </p>
              </div>
              <a
                href={`/catalogue/${slug}`}
                className="text-sm font-black text-[#007f8f]"
              >
                ← Voir toutes les catégories
              </a>
            </div>

            {premiumProducts.length > 0 ? (
              <PremiumCatalog products={premiumProducts} />
            ) : (
              <div className="rounded-[2rem] border border-orange-200 bg-orange-50 p-8 text-sm font-bold text-orange-800">
                Aucun produit disponible dans cette catégorie pour le moment.
              </div>
            )}

          </Container>
        </section>
      ) : null}
    </main>
  );
}
