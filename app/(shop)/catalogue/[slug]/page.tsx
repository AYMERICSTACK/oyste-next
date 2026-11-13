import { getProductCardTitle } from "@/lib/catalogue/repository";
import { getPublicCategory } from "@/lib/catalogue/public-presentation";
import { getEditorialPage, editorialIcon } from "@/lib/editorial";
import { Boxes } from "lucide-react";
import { getPublicPresentation, publicFamilies, familyProducts } from "@/lib/catalogue/public-presentation";
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
  getProductCardImages,
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
  searchParams?: Promise<{ famille?: string; type?: string }>;
}) {
 const page=await getEditorialPage("families");

  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const selectedFamilySlug = resolvedSearchParams?.famille;
  const legacyUniverse = catalogueUniverses.find(
    (item) => item.slug === slug || item.href.endsWith(slug),
  );
  const { categories } = await getPublicPresentation();
  const category = categories.find(item => item.slug === slug && item.isActive && item.catalogueVisible);
  const universe = category ? { ...legacyUniverse, title: category.publicLabel || category.name, icon: legacyUniverse?.icon || Boxes } : undefined;

  if (!universe || !category) notFound();

  const Icon: LucideIcon = universe.icon as LucideIcon;
  const content = { title: category.publicLabel || category.name, description: category.description || "" };
  const subFamilies = publicFamilies(categories, category);
  const selectedFamily = selectedFamilySlug
    ? subFamilies.find(item => item.publicFamilySlug === selectedFamilySlug || item.slug === selectedFamilySlug)
    : undefined;
  const categoryProducts = await getDatabaseProductsByCategory(slug);
  const products = selectedFamily ? familyProducts(categoryProducts, selectedFamily, filterProductsByFamily) : subFamilies.length ? [] : categoryProducts;
  const familyCounts = Object.fromEntries(
    subFamilies.map((family) => {
      const familySlug = family.publicFamilySlug || family.slug;
      return [familySlug, familySlug ? familyProducts(categoryProducts, family, filterProductsByFamily).length : 0];
    }),
  );
  // Navigation Transpalettes : classement visuel sans modification Neon.
  const transpaletteTypes = [
    { slug: "manuel", label: "Manuels" },
    { slug: "electrique", label: "Électriques" },
    { slug: "haute-levee", label: "Haute levée" },
    { slug: "peseur", label: "Peseurs" },
    { slug: "tout-terrain", label: "Tout-terrain" },
    { slug: "accessoires", label: "Accessoires" },
    { slug: "autres", label: "Autres modèles" },
  ];

  const isTranspalette = selectedFamilySlug === "transpalette";
  const selectedType = isTranspalette
    ? resolvedSearchParams?.type
    : undefined;

  const transpaletteClass = (product: (typeof products)[number]) => {
    const source = [
      product.name,
      product.shortName,
      product.categoryPath,
      ...(product.categories || []),
    ].join(" ").normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    if (/accessoire|option|batterie|chargeur|station de chargement/.test(source))
      return "accessoires";
    if (/tout[- ]terrain/.test(source)) return "tout-terrain";
    if (/pesage|peseur|pes[eé]e/.test(source)) return "peseur";
    if (/haute[- ]levee|haute levee|ciseaux/.test(source)) return "haute-levee";
    if (/electrique|motorise|lithium/.test(source)) return "electrique";
    if (/manuel|manuelle/.test(source)) return "manuel";
    return "autres";
  };

  const visibleProducts = isTranspalette && selectedType
    ? products.filter(product => transpaletteClass(product) === selectedType)
    : products;

  const typeCounts = Object.fromEntries(
    transpaletteTypes.map(type => [
      type.slug,
      products.filter(product => transpaletteClass(product) === type.slug).length
    ])
  );

  const premiumProducts: PremiumCatalogItem[] = visibleProducts.map((product) => {
    const isConfigurable = getProductExperienceType(product) === "CONFIGURABLE" || (!product.presentationManagedKeys?.includes("experienceType") && isPotenceProduct(product));
    const capacity = extractCapacity(product);
    const marketingBadges = getProductMarketingBadges(product);

    // OYSTE_VARIANT_CARD_PRICES_V1
    // Utilise uniquement les tarifs positifs des variantes deja presentes.
    const parentPrice = product.minPriceHT ?? product.priceHT;
    const hasParentPrice =
      typeof parentPrice === "number" &&
      Number.isFinite(parentPrice) &&
      parentPrice > 0;

    const variantPrices = (product.variants || [])
      .map((variant) => variant.priceHT)
      .filter(
        (price): price is number =>
          typeof price === "number" &&
          Number.isFinite(price) &&
          price > 0
      );

    const lowestVariantPrice = variantPrices.length
      ? Math.min(...variantPrices)
      : null;

    const inheritedVariantPrice =
      !hasParentPrice && lowestVariantPrice !== null
        ? lowestVariantPrice
        : null;

    const displayPrice = hasParentPrice
      ? parentPrice
      : inheritedVariantPrice;

    const displayPriceLabel = inheritedVariantPrice !== null
      ? `À partir de ${inheritedVariantPrice.toLocaleString("fr-FR", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })} € HT`
      : formatPriceRange(product);

    return {
      id: product.id,featured:product.featured,sortOrder:product.sortOrder,presentationPriority:product.presentationManagedKeys?.some(key=>["featured","sortOrder"].includes(key)),
      code: product.code,
      name: getProductCardTitle(product),
      family: formatCategoryLabel(product.categoryPath),
      description: getCustomerProductDescription(product),
      href: product.href,
      imageUrl: getProductCardImages(product)[0] || "",
      priceLabel: isConfigurable ? "Configuration sur mesure" : displayPriceLabel,
      minPriceHT: displayPrice ?? null,
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
  const isFamilyView = Boolean(selectedFamilySlug) || subFamilies.length === 0;

  return (
    <main className="bg-slate-50 text-slate-950">
      <section className="border-b border-slate-200 bg-white py-9 sm:py-11">
        <Container className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <SectionHeader
            eyebrow={page.fields.content001}
            title={selectedFamily?.title || content?.title || universe.title}
            text={
              selectedFamily
                ? selectedFamily.description || `Découvrez les équipements ${selectedFamily.title.toLowerCase()} disponibles.`
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
                  {page.fields.content002}</p>
                <h2 className="mt-2 text-3xl font-black text-slate-950">
                  {selectedFamily?.title || "Catégorie"}
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                  {page.fields.content003}</p>
              </div>
              <a
                href={`/catalogue/${slug}`}
                className="text-sm font-black text-[#007f8f]"
              >
                {page.fields.content004}</a>
            </div>

            {isTranspalette ? (
              <nav aria-label="Types de transpalettes" className="mb-8">
                <div className="mb-3 text-sm font-bold text-slate-700">
                  Choisir un type de transpalette
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`/catalogue/${slug}?famille=transpalette`}
                    className={`rounded-xl border px-4 py-3 text-sm font-bold ${
                      !selectedType
                        ? "border-[#007f8f] bg-[#007f8f] text-white"
                        : "border-slate-200 bg-slate-50 text-slate-700"
                    }`}
                  >
                    Tous ({products.length})
                  </a>
                  {transpaletteTypes.map(type => (
                    <a
                      key={type.slug}
                      href={`/catalogue/${slug}?famille=transpalette&type=${type.slug}`}
                      className={`rounded-xl border px-4 py-3 text-sm font-bold ${
                        selectedType === type.slug
                          ? "border-[#007f8f] bg-[#007f8f] text-white"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                      }`}
                    >
                      {type.label} ({typeCounts[type.slug]})
                    </a>
                  ))}
                </div>
              </nav>
            ) : null}

            {premiumProducts.length > 0 ? (
              <PremiumCatalog products={premiumProducts} />
            ) : (
              <div className="rounded-[2rem] border border-orange-200 bg-orange-50 p-8 text-sm font-bold text-orange-800">
                {page.fields.content005}</div>
            )}

          </Container>
        </section>
      ) : null}
    </main>
  );
}

export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const category=await getPublicCategory(slug);return {title:category?.seoTitle || category?.publicLabel || category?.name,description:category?.seoDescription || category?.description || undefined};}
