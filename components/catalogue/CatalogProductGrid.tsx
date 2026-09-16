import ProductCard from "./ProductCard";
import {
  formatCategoryLabel,
  formatPriceRange,
  getCustomerProductDescription,
  getProductAvailableDocumentCount,
  getProductMediaImages,
  isPotenceProduct,
  type CatalogueProduct,
} from "@/lib/catalogue/repository";

export default function CatalogProductGrid({ products }: { products: CatalogueProduct[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => {
        const isPotence = isPotenceProduct(product);

        return (
          <ProductCard
            key={product.id}
            code={product.code}
            name={product.name}
            family={formatCategoryLabel(product.categoryPath)}
            price={isPotence ? "Configuration sur mesure" : formatPriceRange(product)}
            description={getCustomerProductDescription(product)}
            href={product.href}
            cta={isPotence ? "Voir la fiche" : "Voir la fiche"}
            imageRef={product.imageRef || product.code}
            imageUrl={getProductMediaImages(product)[0]}
            badge={
              isPotence
                ? "Potence configurable"
                : product.variantCount && product.variantCount > 1
                  ? `${product.variantCount} variantes`
                  : "Catalogue OYSTE"
            }
            documentCount={getProductAvailableDocumentCount(product)}
          />
        );
      })}
    </div>
  );
}
