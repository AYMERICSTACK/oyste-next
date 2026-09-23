import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Container from "@/components/ui/Container";
import ProductCard from "@/components/catalogue/ProductCard";
import CrossSellingSection from "@/components/catalogue/CrossSellingSection";
import ProductVariantSelector from "@/components/catalogue/ProductVariantSelector";
import SmartProductDescription from "@/components/catalogue/SmartProductDescription";
import ProductDocuments from "@/components/catalogue/ProductDocuments";
import type { CapacityRecommendation } from "@/components/catalogue/CapacityRecommendations";
import {
  formatCategoryLabel,
  formatPriceRange,
  getCustomerProductDescription,
  getProductAvailableDocumentCount,
  getProductDocuments,
  getProductMediaImages,
  getRelatedProductsFrom,
  getProductExperienceType,
  getProductConfiguratorHref,
} from "@/lib/catalogue/repository";
import {
  getDatabaseProductBySlug,
  getDatabaseProductsByCategory,
  getDatabaseStockmanFamilyVariants,
} from "@/lib/catalogue/database-repository";
import { getImportedProductImagesExact } from "@/lib/catalogue/media";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; productSlug: string }>;
}): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const product = await getDatabaseProductBySlug(slug, productSlug);

  if (!product) return {};

  const title = product.seoTitle?.trim() || `${product.name} | OYSTE`;
  const description = product.seoDescription?.trim() || getCustomerProductDescription(product);
  const images = getProductMediaImages(product);

  return {
    title,
    description,
    alternates: {
      canonical: `/catalogue/${slug}/${productSlug}`,
    },
    openGraph: {
      title,
      description,
      type: "website",
      images: images[0] ? [{ url: images[0], alt: product.name }] : undefined,
    },
  };
}

export default async function CatalogProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; productSlug: string }>;
  searchParams: Promise<{ variant?: string | string[] }>;
}) {
  const { slug, productSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const initialVariantCode = Array.isArray(resolvedSearchParams.variant)
    ? resolvedSearchParams.variant[0]
    : resolvedSearchParams.variant;
  const product = await getDatabaseProductBySlug(slug, productSlug);

  if (!product) return notFound();

  if (slug === "produit" && product.categorySlug && product.categorySlug !== "produit") {
    redirect(`/catalogue/${product.categorySlug}/${product.slug}`);
  }

  const stockmanFamily = product.variants?.length
    ? { variants: [], optionSchema: [] }
    : await getDatabaseStockmanFamilyVariants(product.id);

  const variants = product.variants?.length
    ? product.variants
    : stockmanFamily.variants.length > 1
      ? stockmanFamily.variants
      : [
          {
            id: product.id,
            code: product.code,
            supplierCode: product.supplierCode,
            name: product.name,
            label: product.name,
            priceHT: product.priceHT,
            delay: product.delay,
            stock: product.stock,
            weightKg: product.weightKg,
            shippingMode: product.shippingMode,
            imageRef: product.imageRef,
            features: product.features,
            options: {},
          },
        ];

  const effectiveOptionSchema = product.optionSchema?.length
    ? product.optionSchema
    : stockmanFamily.optionSchema;

  // La famille Stockman est reconstruite dynamiquement pour les produits importés
  // séparément. Toutes les zones de la fiche doivent utiliser cette vue résolue,
  // pas seulement le sélecteur de variantes.
  const variantCount = Math.max(1, variants.length);
  const resolvedProduct = {
    ...product,
    variants,
    variantCount,
    optionSchema: effectiveOptionSchema,
  };

  const experienceType = getProductExperienceType(resolvedProduct);
  const isConfigurable = experienceType === "CONFIGURABLE";
  const configuratorHref = getProductConfiguratorHref(resolvedProduct);
  const categoryProducts = await getDatabaseProductsByCategory(product.categorySlug);
  const isHoistProduct = /palan/i.test(`${product.categoryPath} ${product.name}`);
  const relatedProducts = isHoistProduct ? [] : getRelatedProductsFrom(categoryProducts, resolvedProduct, 4);
  const explicitCompatibilityCodes = new Set(
    [...(resolvedProduct.relatedProductCodes || []), ...(resolvedProduct.accessoryProductCodes || [])]
      .map((code) => code.trim().toLocaleUpperCase("fr")),
  );
  const compatibleProducts = explicitCompatibilityCodes.size
    ? categoryProducts.filter((candidate) => [candidate.code, candidate.supplierCode, candidate.parentCode]
        .some((code) => explicitCompatibilityCodes.has(String(code || "").trim().toLocaleUpperCase("fr"))))
        .slice(0, 4)
    : [];
  const currentIsHoist = /palan/i.test(`${resolvedProduct.name} ${resolvedProduct.categoryPath}`);
  const currentIsStructure = /potence|portique/i.test(`${resolvedProduct.name} ${resolvedProduct.categoryPath}`);
  const recommendationCandidates: CapacityRecommendation[] = (currentIsHoist || currentIsStructure ? categoryProducts : [])
    .filter((candidate) => candidate.id !== resolvedProduct.id)
    .filter((candidate) => currentIsHoist ? /potence|portique/i.test(`${candidate.name} ${candidate.categoryPath}`) : /palan/i.test(`${candidate.name} ${candidate.categoryPath}`))
    .map((candidate) => {
      const sources = candidate.variants?.length ? candidate.variants : [{ name: candidate.name, options: {}, features: candidate.features }];
      const capacitiesKg = [...new Set(sources.flatMap((variant) => {
        const option = Object.entries(variant.options || {}).find(([label]) => /^(cmu|capacit)/i.test(label))?.[1];
        const feature = variant.features?.find((item) => /cmu|capacit/i.test(item.label))?.value;
        const match = `${option || ""} ${feature || ""} ${variant.name || ""}`.replace(/\s/g, "").match(/(\d+(?:[.,]\d+)?)\s*(kg|t)/i);
        if (!match) return [];
        const amount = Number(match[1].replace(",", "."));
        return [/t/i.test(match[2]) ? amount * 1000 : amount];
      }))];
      return { id: candidate.id, name: candidate.name, href: candidate.href, imageUrl: getProductMediaImages(candidate)[0] || "", type: /portique/i.test(`${candidate.name} ${candidate.categoryPath}`) ? "Portique" : /potence/i.test(`${candidate.name} ${candidate.categoryPath}`) ? "Potence" : "Palan", priceLabel: formatPriceRange(candidate), capacitiesKg };
    })
    .filter((candidate) => candidate.capacitiesKg.length > 0);
  const documents = getProductDocuments(resolvedProduct);
  const availableDocumentCount = getProductAvailableDocumentCount(resolvedProduct);
  const mediaImages = getProductMediaImages(resolvedProduct);
  const variantGalleryImages = Object.fromEntries(
    variants.map((variant) => {
      const exactImages = getImportedProductImagesExact(variant.imageRef, variant.code);
      const isPalfix = variant.code.trim().toUpperCase().startsWith("PALFIX");

      // PALFIX possède deux sources média pour une même référence :
      // le rendu ADEI (maquette correcte) et un visuel COMEGE pouvant porter
      // un marquage de capacité qui ne correspond pas à la variante affichée.
      // Pour cette famille, la galerie publique doit donc conserver uniquement
      // le rendu ADEI attaché à la référence exacte.
      const publicImages = isPalfix
        ? exactImages.filter((url) => url.includes("/media/photos/ADEI/"))
        : exactImages;

      return [variant.code, publicImages];
    }),
  );
  const familyLabel = formatCategoryLabel(product.categoryPath);

  return (
    <main className="bg-slate-50 text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <Container className="py-6 sm:py-8">
          <a
            href={`/catalogue/${slug}`}
            className="inline-flex items-center gap-2 text-sm font-black text-[#007f8f] transition hover:text-orange-600"
          >
            <ArrowLeft size={17} /> Retour à la catégorie
          </a>

          <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div><p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">{familyLabel} · Réf. {product.parentCode || product.code}</p><h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">{product.name}</h1></div>
            <p className="text-lg font-black text-orange-600">{isConfigurable ? "Configuration sur mesure" : formatPriceRange(product)}</p>
          </div>
        </Container>
      </section>

      <Container className="py-7 lg:py-9">
        <ProductVariantSelector
          productName={product.name}
          productCode={product.code}
          parentCode={product.parentCode || product.code}
          supplier={product.manufacturer}
          productWeightKg={product.weightKg}
          productShippingMode={product.shippingMode}
          variants={variants}
          optionSchema={effectiveOptionSchema}
          initialVariantCode={initialVariantCode}
          isConfiguratorProduct={isConfigurable}
          configuratorHref={configuratorHref}
          galleryImages={mediaImages}
          variantGalleryImages={variantGalleryImages}
          productHref={`/catalogue/${slug}/${productSlug}`}
          familyLabel={familyLabel}
          documentCount={availableDocumentCount}
          recommendationCandidates={recommendationCandidates}
        />

        <div id="presentation-produit" className="mt-8 scroll-mt-28">
          <SmartProductDescription product={product} />
        </div>

        <div className="mt-8 scroll-mt-28">
          <ProductDocuments
            documents={documents}
            availableDocumentCount={availableDocumentCount}
            productName={product.name}
          />
        </div>

        <CrossSellingSection products={compatibleProducts} />

        {relatedProducts.length > 0 ? (
          <section
            id="produits-associes"
            className="scroll-mt-28 mt-14 rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm lg:p-8"
          >
            <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-600">Produits associés</p>
                <h2 className="mt-2 text-3xl font-black text-slate-950">Produits similaires</h2>
              </div>
              <a href={`/catalogue/${slug}`} className="text-sm font-black text-[#007f8f]">
                Voir la catégorie complète →
              </a>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {relatedProducts.map((related) => (
                <ProductCard
                  key={related.id}
                  code={related.code}
                  name={related.name}
                  family={formatCategoryLabel(related.categoryPath)}
                  price={formatPriceRange(related)}
                  description={getCustomerProductDescription(related)}
                  href={related.href}
                  cta={getProductExperienceType(related) === "CONFIGURABLE" ? "Voir puis configurer" : "Voir la fiche"}
                  imageRef={related.imageRef}
                  imageUrl={getProductMediaImages(related)[0]}
                  badge={related.code}
                  documentCount={getProductAvailableDocumentCount(related)}
                />
              ))}
            </div>
          </section>
        ) : null}
      </Container>
    </main>
  );
}
