import {
  CheckCircle2,
  Filter,
  PackageSearch,
  type LucideIcon,
} from "lucide-react";
import Container from "@/components/ui/Container";
import SectionHeader from "@/components/ui/SectionHeader";
import PremiumCatalog, { type PremiumCatalogItem } from "@/components/catalogue/PremiumCatalog";
import IndustrialFamilyNavigation from "@/components/catalogue/IndustrialFamilyNavigation";
import { catalogueUniverses } from "@/data/catalogue";
import {
  catalogueCategoryContent,
  catalogueSubFamilies,
  getCatalogCategory,
  getCategoryFacets,
  formatCategoryLabel,
  formatPriceRange,
  getCustomerProductDescription,
  getProductAvailableDocumentCount,
  getProductExperienceType,
  getProductMarketingBadges,
  getSubFamilyBySlug,
  filterProductsByFamily,
  isPotenceProduct,
} from "@/lib/catalogue/repository";
import { getDatabaseProductsByCategory } from "@/lib/catalogue/database-repository";
import { notFound } from "next/navigation";
import { getProductImageUrl } from "@/lib/product-images";


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
  const facets = getCategoryFacets(products);
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
      imageUrl: getProductImageUrl(product.imageRef || product.code, product.code),
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
      <section className="bg-white py-16">
        <Container className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <SectionHeader
            eyebrow="Catalogue manutention OYSTE"
            title={selectedFamily?.title || content?.title || universe.title}
            text={
              selectedFamily
                ? `Famille ${selectedFamily.title} : références standards consultables en catalogue OYSTE.`
                : content?.description ||
                  category.description ||
                  universe.description
            }
          />

          <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#007f8f]/10 text-[#005466]">
              <Icon size={42} strokeWidth={1.6} />
            </div>
            <p className="mt-6 text-sm font-black uppercase tracking-[0.25em] text-orange-600">
              {content?.breadcrumb || "Catalogue manutention OYSTE"}
            </p>
            <h1 className="mt-3 text-4xl font-black text-slate-950">
              {selectedFamily?.title || universe.subtitle}
            </h1>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              {isFamilyView
                ? "Les références sont filtrées sur la famille choisie pour garder un parcours clair et industriel."
                : "Choisissez une famille avant d’afficher les produits : la navigation reste lisible, même avec un catalogue très large."}
            </p>
          </div>
        </Container>
      </section>

      {!isFamilyView && subFamilies.length > 0 ? (
        <section className="py-16">
          <Container>
            <IndustrialFamilyNavigation
              categorySlug={slug}
              title={`Familles ${content?.title || universe.title}`}
              families={subFamilies}
              familyCounts={familyCounts}
            />
          </Container>
        </section>
      ) : null}

      {isFamilyView ? (
        <section className="bg-white py-16">
          <Container>
            <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-600">
                  Produits de la famille
                </p>
                <h2 className="mt-2 text-3xl font-black text-slate-950">
                  {selectedFamily?.title || "Famille catalogue"}
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                  Vous êtes directement dans la famille sélectionnée : les
                  références apparaissent immédiatement, sans réafficher toutes
                  les familles catalogue.
                </p>
              </div>
              <a
                href={`/catalogue/${slug}`}
                className="text-sm font-black text-[#007f8f]"
              >
                ← Voir toutes les familles
              </a>
            </div>

            <div className="mb-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                <PackageSearch className="text-[#007f8f]" size={24} />
                <p className="mt-4 text-2xl font-black text-slate-950">
                  {products.length}
                </p>
                <p className="text-sm font-bold text-slate-600">
                  produits parents
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                <CheckCircle2 className="text-[#007f8f]" size={24} />
                <p className="mt-4 text-2xl font-black text-slate-950">
                  {facets.configurableProducts.length}
                </p>
                <p className="text-sm font-bold text-slate-600">
                  produits avec variantes
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                <Filter className="text-[#007f8f]" size={24} />
                <p className="mt-4 text-2xl font-black text-slate-950">
                  {facets.totalVariants}
                </p>
                <p className="text-sm font-bold text-slate-600">
                  variantes disponibles
                </p>
              </div>
            </div>

            {premiumProducts.length > 0 ? (
              <PremiumCatalog products={premiumProducts} />
            ) : (
              <div className="rounded-[2rem] border border-orange-200 bg-orange-50 p-8 text-sm font-bold text-orange-800">
                Aucun produit importé pour cette famille pour le moment.
              </div>
            )}

          </Container>
        </section>
      ) : null}
    </main>
  );
}
