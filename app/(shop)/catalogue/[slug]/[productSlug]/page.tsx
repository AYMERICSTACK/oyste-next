import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  Ruler,
  ShieldCheck,
  TableProperties,
  Truck,
  Wrench,
} from "lucide-react";
import { notFound } from "next/navigation";
import Container from "@/components/ui/Container";
import ProductCard from "@/components/catalogue/ProductCard";
import CrossSellingSection from "@/components/catalogue/CrossSellingSection";
import ProductVariantSelector from "@/components/catalogue/ProductVariantSelector";
import SmartProductDescription from "@/components/catalogue/SmartProductDescription";
import ProductDocuments from "@/components/catalogue/ProductDocuments";
import ProductFaq from "@/components/catalogue/ProductFaq";
import ProductApplications from "@/components/catalogue/ProductApplications";
import ProductTrustStrip from "@/components/catalogue/ProductTrustStrip";
import {
  formatCategoryLabel,
  formatPriceRange,
  getCustomerProductDescription,
  getProductConfigurationColumns,
  getProductConfigurationRows,
  getCrossSellProductsFrom,
  getProductAvailableDocumentCount,
  getProductDocuments,
  getProductHighlights,
  getProductMediaImages,
  getProductTechnicalRows,
  getProductTrustBadges,
  getRelatedProductsFrom,
  getProductExperienceType,
  getProductConfiguratorHref,
  getProductConfiguratorFamily,
  getProductMarketingBadges,
  getProductFaq,
} from "@/lib/catalogue/repository";
import {
  getDatabaseProductBySlug,
  getDatabaseProductsByCategory,
} from "@/lib/catalogue/database-repository";

export default async function CatalogProductPage({
  params,
}: {
  params: Promise<{ slug: string; productSlug: string }>;
}) {
  const { slug, productSlug } = await params;
  const product = await getDatabaseProductBySlug(slug, productSlug);

  if (!product) return notFound();

  const variants = product.variants?.length
    ? product.variants
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
          imageRef: product.imageRef,
          features: product.features,
          options: {},
        },
      ];

  const highlights = getProductHighlights(product);
  const heroDescription = getCustomerProductDescription(product);
  const experienceType = getProductExperienceType(product);
  const isConfigurable = experienceType === "CONFIGURABLE";
  const configuratorFamily = getProductConfiguratorFamily(product);
  const configuratorHref = getProductConfiguratorHref(product);
  const categoryProducts = await getDatabaseProductsByCategory(product.categorySlug);
  const relatedProducts = getRelatedProductsFrom(categoryProducts, product, 3);
  const crossSellProducts = getCrossSellProductsFrom(categoryProducts, product, 4);
  const variantCount = product.variantCount || variants.length || 1;
  const technicalRows = getProductTechnicalRows(product);
  const configurationColumns = getProductConfigurationColumns(product);
  const configurationRows = getProductConfigurationRows(product, 12);
  const hiddenConfigurationCount = Math.max(0, variantCount - configurationRows.length);
  const documents = getProductDocuments(product);
  const availableDocumentCount = getProductAvailableDocumentCount(product);
  const mediaImages = getProductMediaImages(product);
  const trustBadges = getProductTrustBadges(product);
  const familyLabel = formatCategoryLabel(product.categoryPath);
  const marketingBadges = getProductMarketingBadges(product);
  const catalogueBadges = Array.from(
    new Map(
      [...marketingBadges, ...trustBadges].map((badge) => [badge.trim().toLocaleLowerCase("fr"), badge.trim()]),
    ).values(),
  ).slice(0, 6);
  const faq = getProductFaq(product);

  return (
    <main className="bg-slate-50 text-slate-950">
      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-br from-[#005466] via-[#007f8f] to-slate-950" />
        <Container className="relative py-10 lg:py-14">
          <a
            href={`/catalogue/${slug}`}
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white backdrop-blur transition hover:bg-white/20"
          >
            <ArrowLeft size={17} /> Retour à la famille
          </a>

          <div className="mt-8 rounded-[2.5rem] border border-white/20 bg-white p-5 shadow-2xl shadow-slate-950/10 lg:p-8">
            <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
              <div className="rounded-[2rem] bg-slate-50 p-6 lg:p-8">
                <div className="flex flex-wrap gap-3">
                  <span className="rounded-full bg-orange-100 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-orange-700">
                    {familyLabel}
                  </span>
                  <span className="rounded-full bg-[#007f8f]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-[#005466]">
                    Réf. {product.parentCode || product.code}
                  </span>
                  {isConfigurable ? (
                    <span className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-white">
                      Sur mesure{configuratorFamily ? ` · ${configuratorFamily}` : ""}
                    </span>
                  ) : null}
                </div>

                <h1 className="mt-6 max-w-4xl text-4xl font-black leading-tight text-slate-950 lg:text-5xl">
                  {product.name}
                </h1>
                <p className="mt-5 max-w-4xl text-lg leading-8 text-slate-600">
                  {heroDescription}
                </p>

                <div className="mt-7 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Prix</p>
                    <p className="mt-2 text-lg font-black text-orange-600">{formatPriceRange(product)}</p>
                  </div>
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Variantes</p>
                    <p className="mt-2 text-lg font-black text-slate-950">{variantCount}</p>
                  </div>
                  <div className="rounded-3xl bg-white p-5 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Délai</p>
                    <p className="mt-2 text-lg font-black text-slate-950">{product.delay || "Sur demande"}</p>
                  </div>
                </div>

                {isConfigurable ? (
                  <div className="mt-7 rounded-[1.5rem] border border-orange-200 bg-orange-50 p-5">
                    <p className="text-sm font-black uppercase tracking-[0.22em] text-orange-700">
                      Produit fabriqué sur mesure
                    </p>
                    <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <p className="max-w-3xl text-sm font-bold leading-6 text-slate-700">
                        Cette fiche vous présente le produit, ses usages et ses caractéristiques. La capacité, la portée et les options sont ensuite définies dans un parcours guidé avant l’ajout au panier.
                      </p>
                      <a
                        href={configuratorHref}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black uppercase text-white transition hover:bg-[#005466]"
                      >
                        Configurer ce produit <ArrowRight size={17} />
                      </a>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4">
                <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
                  <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-300">Accompagnement OYSTE</p>
                  <h2 className="mt-4 text-3xl font-black">Une fiche pensée pour décider vite.</h2>
                  <p className="mt-4 text-sm leading-7 text-slate-300">
                    Variantes, prix, caractéristiques et documents sont regroupés pour faciliter l&apos;achat en ligne et préparer la validation technique.
                  </p>
                  <div className="mt-6 grid gap-3 text-sm font-bold text-slate-200">
                    <div className="flex items-center gap-3"><ShieldCheck className="text-orange-300" size={19} /> Sélection industrielle contrôlée</div>
                    <div className="flex items-center gap-3"><Truck className="text-orange-300" size={19} /> Délai visible ou confirmé sur devis</div>
                    <div className="flex items-center gap-3"><Wrench className="text-orange-300" size={19} /> Conseil technique possible avant validation</div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <BadgeCheck className="text-[#007f8f]" size={24} />
                    <p className="mt-3 text-sm font-black uppercase tracking-[0.2em] text-slate-500">Usage</p>
                    <p className="mt-2 text-sm font-bold leading-6 text-slate-700">Matériel sélectionné pour un usage professionnel.</p>
                  </div>
                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <Ruler className="text-[#007f8f]" size={24} />
                    <p className="mt-3 text-sm font-black uppercase tracking-[0.2em] text-slate-500">Données</p>
                    <p className="mt-2 text-sm font-bold leading-6 text-slate-700">Caractéristiques et variantes regroupées automatiquement.</p>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Garanties catalogue</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {catalogueBadges.map((badge) => (
                      <span key={badge} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700">
                        {badge}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <Container className="py-12 lg:py-16">
        <ProductVariantSelector
          productName={product.name}
          productCode={product.code}
          parentCode={product.parentCode || product.code}
          supplier={product.manufacturer}
          productWeightKg={product.weightKg}
          productShippingMode={product.shippingMode}
          variants={variants}
          optionSchema={product.optionSchema || []}
          isConfiguratorProduct={isConfigurable}
          configuratorHref={configuratorHref}
          galleryImages={mediaImages}
          productHref={`/catalogue/${slug}/${productSlug}`}
          familyLabel={familyLabel}
          documentCount={availableDocumentCount}
        />

        <div className="mt-6">
          <ProductTrustStrip />
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_0.65fr]">
          <div className="grid gap-6">
            <SmartProductDescription product={product} />

            <ProductFaq items={faq} />

            <section className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-600">Données produit</p>
                  <h2 className="mt-2 text-3xl font-black text-slate-950">Tableau technique</h2>
                  <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-slate-600">
                    Les informations disponibles sont consolidées depuis la fiche, les variantes et les caractéristiques importées. Elles servent de base au choix de la bonne référence avant achat.
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-[#007f8f]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#005466]">
                  <TableProperties size={16} /> {technicalRows.length} champs
                </span>
              </div>

              <div className="mt-7 overflow-hidden rounded-[1.5rem] border border-slate-200">
                {technicalRows.map((row, index) => (
                  <div
                    key={`${row.label}-${row.value}`}
                    className={`grid gap-2 px-5 py-4 text-sm md:grid-cols-[0.42fr_0.58fr] ${index % 2 === 0 ? "bg-slate-50" : "bg-white"}`}
                  >
                    <p className="font-black text-slate-950">{row.label}</p>
                    <p className="font-bold text-slate-600">{row.value}</p>
                  </div>
                ))}
              </div>

              {configurationRows.length > 0 ? (
                <div className="mt-8 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4 lg:p-5">
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-[#007f8f]">
                        Configurations disponibles
                      </p>
                      <h3 className="mt-2 text-2xl font-black text-slate-950">Variantes catalogue</h3>
                      <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
                        Les combinaisons techniques sont regroupées dans un tableau dédié afin d&apos;éviter les lignes répétées dans la fiche technique.
                      </p>
                    </div>
                    <span className="w-fit rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-600 shadow-sm">
                      {variantCount} variantes
                    </span>
                  </div>

                  <div className="mt-5 overflow-x-auto rounded-[1.25rem] border border-slate-200 bg-white">
                    <table className="min-w-full border-collapse text-left text-sm">
                      <thead className="bg-slate-950 text-white">
                        <tr>
                          <th className="whitespace-nowrap px-4 py-3 font-black">Référence</th>
                          {configurationColumns.map((column) => (
                            <th key={column} className="whitespace-nowrap px-4 py-3 font-black">
                              {column}
                            </th>
                          ))}
                          <th className="whitespace-nowrap px-4 py-3 font-black">Prix indicatif</th>
                        </tr>
                      </thead>
                      <tbody>
                        {configurationRows.map((configuration, index) => (
                          <tr key={configuration.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                            <td className="whitespace-nowrap px-4 py-3 font-black text-slate-950">
                              {configuration.reference}
                            </td>
                            {configurationColumns.map((column) => (
                              <td key={`${configuration.id}-${column}`} className="whitespace-nowrap px-4 py-3 font-bold text-slate-600">
                                {configuration.options[column] || "—"}
                              </td>
                            ))}
                            <td className="whitespace-nowrap px-4 py-3 font-black text-orange-600">
                              {configuration.price}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {hiddenConfigurationCount > 0 ? (
                    <p className="mt-4 text-xs font-bold leading-5 text-slate-500">
                      Aperçu limité aux 12 premières configurations. Les {hiddenConfigurationCount} autres variantes restent disponibles dans le sélecteur de variantes situé en haut de la fiche.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>

          <aside className="grid h-fit gap-6 lg:sticky lg:top-24">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
              <p className="text-sm font-black uppercase tracking-[0.25em] text-slate-500">
                Informations produit
              </p>
              <div className="mt-4 grid gap-3 text-sm font-bold text-slate-700">
                {highlights.map((item) => (
                  <div key={item.label} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#007f8f]" />
                    <span>
                      <span className="font-black text-slate-950">{item.label} : </span>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section id="demande-devis" className="rounded-[2rem] border border-orange-200 bg-orange-50 p-8">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-orange-600 shadow-sm">
                  <ClipboardList size={22} />
                </span>
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.22em] text-orange-700">Commander en ligne</p>
                  <p className="mt-3 text-sm font-bold leading-7 text-slate-700">
                    Ajoutez la référence au panier pour construire votre commande. Les produits sur mesure passent naturellement par le configurateur avant de revenir dans le panier.
                  </p>
                </div>
              </div>
            </section>

            <ProductDocuments
              documents={documents}
              availableDocumentCount={availableDocumentCount}
              productName={product.name}
            />
          </aside>
        </div>

        <div className="mt-10">
          <ProductApplications product={product} />
        </div>

        <CrossSellingSection product={product} products={crossSellProducts} />

        {relatedProducts.length > 0 ? (
          <section className="mt-14 rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
            <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-600">Produits associés</p>
                <h2 className="mt-2 text-3xl font-black text-slate-950">À comparer dans la même famille</h2>
              </div>
              <a href={`/catalogue/${slug}`} className="text-sm font-black text-[#007f8f]">
                Voir la famille complète →
              </a>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
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
                  badge={(related.variantCount || related.variants?.length || 1) > 1 ? `${related.variantCount || related.variants?.length} variantes` : "Catalogue OYSTE"}
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
