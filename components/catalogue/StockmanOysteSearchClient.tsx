
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProductCard from "@/components/catalogue/ProductCard";

type Product = {
  priceHT?: number | null;
  reference: string;
  title: string;
  category: string;
  subcategory: string;
  imageUrl: string;
};

export default function StockmanOysteSearchClient() {
  const searchParams = useSearchParams();
  const query = (searchParams.get("q") || "").trim();
  const [products, setProducts] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    fetch("/stockman-oyste-search-index.json")
      .then(response => {
        if (!response.ok) throw new Error("Index indisponible");
        return response.json();
      })
      .then((data: Product[]) => {
        if (active) {
          setProducts(data);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) setLoaded(true);
      });

    return () => { active = false; };
  }, []);

  if (!query) return null;

  const normalized = query.toLocaleLowerCase("fr");

  const matches = products.filter(product =>
    [
      product.reference,
      product.title,
      product.category,
      product.subcategory
    ].join(" ").toLocaleLowerCase("fr").includes(normalized)
  );

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-widest text-orange-600">
          Catalogue OYSTE
        </p>

        <h2 className="mt-2 text-2xl font-black text-slate-950">
          Produits correspondant à « {query} »
        </h2>

        <p className="mt-2 text-sm text-slate-600">
          {!loaded
            ? "Recherche en cours..."
            : matches.length + " références complémentaires"}
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {matches.slice(0, 36).map(product => (
          <ProductCard
            key={product.reference}
            code={product.reference}
            name={product.title}
            family={product.subcategory || product.category}
            price={typeof product.priceHT === "number" && product.priceHT > 0 ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(product.priceHT) + " HT" : "Nous consulter"}
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

      {matches.length > 36 ? (
        <p className="mt-6 text-sm text-slate-600">
          36 premiers résultats affichés. Affinez votre recherche.
        </p>
      ) : null}
    </section>
  );
}
