import { ArrowRight, CheckCircle2, Layers3, ShoppingCart, Sparkles } from "lucide-react";
import AddToCartButton from "@/components/cart/AddToCartButton";
import {
  formatCategoryLabel,
  formatPriceRange,
  getCustomerProductDescription,
  isPotenceProduct,
  type CatalogueProduct,
} from "@/lib/catalogue/repository";
import { getProductImageUrl } from "@/lib/product-images";

function getQuickAddPrice(product: CatalogueProduct) {
  if (typeof product.priceHT === "number") return product.priceHT;
  if (typeof product.minPriceHT === "number" && product.minPriceHT === product.maxPriceHT) return product.minPriceHT;
  if (product.variants?.length === 1 && typeof product.variants[0]?.priceHT === "number") return product.variants[0].priceHT;
  return null;
}

function getProductHref(product: CatalogueProduct) {
  return product.href || `/catalogue/${product.categorySlug}/${product.slug}`;
}

export default function CrossSellingSection({
  product,
  products,
}: {
  product: CatalogueProduct;
  products: CatalogueProduct[];
}) {
  if (!products.length) return null;

  const productFamily = formatCategoryLabel(product.categoryPath);

  return (
    <section className="mt-14 overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-sm">
      <div className="relative bg-slate-950 p-6 text-white lg:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.24),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(0,127,143,0.24),transparent_36%)]" />
        <div className="relative flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.25em] text-orange-300">
              <Sparkles size={18} /> Complétez votre achat
            </p>
            <h2 className="mt-3 text-3xl font-black text-white lg:text-4xl">Produits compatibles</h2>
            <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-slate-300">
              Sélection automatique d'accessoires et d'équipements cohérents avec la famille {productFamily.toLowerCase()}.
            </p>
          </div>
          <span className="w-fit rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white backdrop-blur">
            Sélection OYSTE
          </span>
        </div>
      </div>

      <div className="grid gap-5 p-6 md:grid-cols-2 xl:grid-cols-4 lg:p-8">
        {products.map((item) => {
          const href = getProductHref(item);
          const imageUrl = getProductImageUrl(item.imageRef, item.code, item.parentCode);
          const isConfigurable = isPotenceProduct(item);
          const variantCount = item.variantCount || item.variants?.length || 1;
          const quickAddPrice = getQuickAddPrice(item);
          const canQuickAdd = !isConfigurable && variantCount <= 1 && quickAddPrice !== null;

          return (
            <article
              key={item.id}
              className="group flex h-full flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-50 transition hover:-translate-y-1 hover:border-[#007f8f]/30 hover:bg-white hover:shadow-xl hover:shadow-slate-950/10"
            >
              <a href={href} className="relative flex aspect-[4/3] items-center justify-center bg-white">
                <span className="absolute left-4 top-4 rounded-full bg-slate-950 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                  {isConfigurable ? "Configurable" : variantCount > 1 ? `${variantCount} variantes` : "Compatible"}
                </span>
                <img
                  src={imageUrl}
                  alt={item.name}
                  className="h-full w-full object-contain p-6 transition duration-500 group-hover:scale-[1.04]"
                />
              </a>

              <div className="flex flex-1 flex-col p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">
                  {formatCategoryLabel(item.categoryPath)}
                </p>
                <h3 className="mt-3 text-lg font-black leading-tight text-slate-950">{item.name}</h3>
                <p className="mt-3 line-clamp-3 text-sm font-bold leading-6 text-slate-600">
                  {getCustomerProductDescription(item)}
                </p>

                <div className="mt-5 grid gap-2 text-xs font-black text-slate-600">
                  <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2">
                    <CheckCircle2 size={15} className="text-[#007f8f]" /> Compatible commande industrielle
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2">
                    <Layers3 size={15} className="text-[#007f8f]" /> {formatPriceRange(item)}
                  </div>
                </div>

                <div className="mt-auto pt-5">
                  {canQuickAdd ? (
                    <AddToCartButton
                      name={item.name}
                      code={item.code}
                      family={formatCategoryLabel(item.categoryPath)}
                      supplier={item.manufacturer}
                      weightKg={item.weightKg ?? undefined}
                      shippingMode={item.shippingMode}
                      imageUrl={imageUrl}
                      priceHT={quickAddPrice}
                      delay={item.delay}
                      href={href}
                      technicalLines={(item.features || []).slice(0, 3)}
                      label="Ajouter"
                      className="w-full px-4 py-3 text-xs"
                    />
                  ) : (
                    <a
                      href={isConfigurable ? `/configurateur?produit=${item.slug}&type=${item.parentCode || item.code}` : href}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-xs font-black uppercase text-white shadow-lg shadow-orange-600/15 transition hover:bg-orange-700"
                    >
                      {isConfigurable ? "Configurer" : "Choisir"}
                      {isConfigurable ? <ShoppingCart size={16} /> : <ArrowRight size={16} />}
                    </a>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
