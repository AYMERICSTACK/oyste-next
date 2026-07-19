import {
  formatCategoryLabel,
  formatPriceRange,
  getProductAvailableDocumentCount,
  type CatalogueProduct,
} from "@/lib/catalogue/repository";
import ProductCard from "./ProductCard";

export default function ProductGrid({ products }: { products: CatalogueProduct[] }) {

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-600">
            Catalogue structuré
          </p>
          <h2 className="mt-2 text-3xl font-black text-slate-950">
            Les premières solutions catalogue
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Les potences partent vers l’assistant. Les autres familles restent dans le catalogue avec fiches produit, images, délais et demandes de devis.
          </p>
        </div>
        <a href="/catalogue" className="text-sm font-black text-[#007f8f]">
          Voir tous les univers →
        </a>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            code={product.code}
            name={product.name}
            family={formatCategoryLabel(product.categoryPath)}
            price={formatPriceRange(product)}
            description={product.description}
            href={product.href}
            cta="Voir la fiche"
            imageRef={product.imageRef || product.code}
            badge={
              product.variantCount && product.variantCount > 1
                ? `${product.variantCount} variantes`
                : "Catalogue OYSTE"
            }
            documentCount={getProductAvailableDocumentCount(product)}
          />
        ))}
      </div>
    </div>
  );
}
