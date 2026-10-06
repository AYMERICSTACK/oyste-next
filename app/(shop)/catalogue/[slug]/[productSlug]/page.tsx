import { getProductCardTitle } from "@/lib/catalogue/repository";
import { resolvePresentedVariants } from "@/lib/catalogue/product-presentation";
import { getEditorialPage, editorialIcon } from "@/lib/editorial";
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
  getDatabaseProductsByCodes,
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
      canonical: product.href,
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
 const page=await getEditorialPage("product");

  const { slug, productSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const initialVariantCode = Array.isArray(resolvedSearchParams.variant)
    ? resolvedSearchParams.variant[0]
    : resolvedSearchParams.variant;
  const product = await getDatabaseProductBySlug(slug, productSlug);

  if (!product) return notFound();

  if (product.categorySlug && slug !== product.categorySlug) {
    redirect(`/catalogue/${product.categorySlug}/${product.slug}`);
  }

  const stockmanFamily = !product.includeSupplierFamilyVariants && (product.baseVariants?.length || product.variants?.length)
    ? { variants: [], optionSchema: [] }
    : await getDatabaseStockmanFamilyVariants(product.id);

  const variants = resolvePresentedVariants(product,stockmanFamily.variants);

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
  const relatedProducts = resolvedProduct.presentationManagedKeys?.includes("relatedProductCodes")
    ? await getDatabaseProductsByCodes(resolvedProduct.relatedProductCodes || [])
    : isHoistProduct ? [] : getRelatedProductsFrom(categoryProducts, resolvedProduct, 4);
  const explicitCompatibilityCodes = new Set(
    [...(resolvedProduct.relatedProductCodes || []), ...(resolvedProduct.accessoryProductCodes || [])]
      .map((code) => code.trim().toLocaleUpperCase("fr")),
  );
  const compatibleCandidates = explicitCompatibilityCodes.size ? await getDatabaseProductsByCodes([...explicitCompatibilityCodes]) : [];
  const compatibleProducts = explicitCompatibilityCodes.size
    ? compatibleCandidates.filter((candidate) => [candidate.code, candidate.supplierCode, candidate.parentCode]
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
      if (product.presentationManagedKeys?.includes("media")) return [variant.code, mediaImages];
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
            <ArrowLeft size={17} /> {page.fields.content001}</a>

          <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div><p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">{familyLabel} {page.fields.content002}{product.parentCode || product.code}</p><h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">{product.name}</h1></div>
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
          mediaManaged={product.presentationManagedKeys?.includes("media")}
          variantGalleryImages={variantGalleryImages}
          productHref={`/catalogue/${slug}/${productSlug}`}
          familyLabel={familyLabel}
          documentCount={availableDocumentCount}
          recommendationCandidates={recommendationCandidates}
        />

        <div id="presentation-produit" className="mt-8 scroll-mt-28">
          <SmartProductDescription product={product} />
        </div>

        {(["marketingBadges","features","faq","videoUrls"].some(key=>product.presentationManagedKeys?.includes(key)) && !!(product.marketingBadges?.length || product.features.length || product.faq?.length || product.videoUrls?.length)) && <section className="mt-8 grid gap-6 md:grid-cols-2">
          {product.presentationManagedKeys?.includes("marketingBadges") && product.marketingBadges?.length ? <div className="flex flex-wrap gap-2">{product.marketingBadges.map(badge => <span key={badge} className="rounded-full bg-orange-50 px-3 py-2 text-sm font-bold text-orange-700">{badge}</span>)}</div> : null}
          {product.presentationManagedKeys?.includes("features") && product.features.length ? <dl className="rounded-2xl border bg-white p-5">{product.features.map((feature, index) => <div key={index} className="grid grid-cols-2 gap-3 border-b py-2"><dt className="font-bold">{feature.label}</dt><dd>{feature.value}</dd></div>)}</dl> : null}
          {product.presentationManagedKeys?.includes("faq") && product.faq?.length ? <div className="rounded-2xl border bg-white p-5">{product.faq.map((item, index) => <details key={index} className="py-2"><summary className="font-bold">{item.question}</summary><p className="mt-2 whitespace-pre-line">{item.answer}</p></details>)}</div> : null}
          {product.presentationManagedKeys?.includes("videoUrls") && product.videoUrls?.length ? <div className="space-y-3">{product.videoUrls.map(url => /\.(mp4|webm)(?:[?#]|$)/i.test(url) ? <video key={url} src={url} controls className="w-full rounded-xl" /> : <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block font-bold text-[#007f8f]">{url}</a>)}</div> : null}
        </section>}

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
                <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-600">{page.fields.content003}</p>
                <h2 className="mt-2 text-3xl font-black text-slate-950">{page.fields.content004}</h2>
              </div>
              <a href={`/catalogue/${slug}`} className="text-sm font-black text-[#007f8f]">
                {page.fields.content005}</a>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {relatedProducts.map((related) => (
                <ProductCard
                  key={related.id}
                  code={related.code}
                  name={getProductCardTitle(related)}
                  family={formatCategoryLabel(related.categoryPath)}
                  price={formatPriceRange(related)}
                  description={getCustomerProductDescription(related)}
                  href={related.href}
                  cta={getProductExperienceType(related) === "CONFIGURABLE" ? "Voir puis configurer" : "Voir la fiche"}
                  imageRef={related.imageRef}
                  imageUrl={getProductMediaImages(related)[0] ?? (related.presentationManagedKeys?.includes("media") ? "" : undefined)} badges={related.presentationManagedKeys?.includes("marketingBadges") ? related.marketingBadges : undefined}
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
