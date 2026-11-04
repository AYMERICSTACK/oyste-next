import { formatStockmanSellingPrice } from "@/lib/catalogue/stockman-selling-prices";

import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import ProductCard from "@/components/catalogue/ProductCard";

type StockmanProduct = {
  reference: string;
  title: string;
  category: string;
  subcategory: string;
  imageUrl: string;
};

export default function StockmanOysteResults({
  query = ""
}: {
  query?: string;
}) {
  const file = path.join(
    process.cwd(),
    "data", "stockman", "catalogue-produits.json"
  );

  const data = JSON.parse(
    fs.readFileSync(file, "utf8")
  ) as { products: StockmanProduct[] };

  const normalized = query.trim().toLocaleLowerCase("fr");

  if (!normalized) return null;

  const results = data.products.filter(product =>
    [
      product.reference,
      product.title,
      product.category,
      product.subcategory
    ].join(" ").toLocaleLowerCase("fr").includes(normalized)
  );

  if (!results.length) return null;

  return (
    <section className="mt-10 border-t border-slate-200 pt-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">
            Produits du catalogue OYSTE
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">
            Autres produits correspondant à votre recherche
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {results.length} références disponibles sur demande
          </p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {results.slice(0, 36).map(product => (
          <ProductCard
            key={product.reference}
            code={product.reference}
            name={product.title}
            family={product.subcategory || product.category}
            price={formatStockmanSellingPrice(product.reference)}
            description=""
            href={
              "/catalogue/stockman/" +
              encodeURIComponent(product.reference)
            }
            cta="Voir le produit"
            imageUrl={product.imageUrl}
          />
        ))}
      </div>

      {results.length > 36 ? (
        <p className="mt-6 text-sm text-slate-600">
          Affichage des 36 premiers résultats.
          Affinez votre recherche pour voir d'autres produits.
        </p>
      ) : null}
    </section>
  );
}
