import { formatStockmanSellingPrice } from "@/lib/catalogue/stockman-selling-prices";

import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import Container from "@/components/ui/Container";
import ProductCard from "@/components/catalogue/ProductCard";

export const dynamic = "force-dynamic";

type Product = {
  reference: string;
  title: string;
  category: string;
  subcategory: string;
  sourceUrl: string;
  imageUrl: string;
};

export default async function StockmanCatalogue({
  searchParams
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;

  const file = path.join(
    process.cwd(),
    "data", "stockman", "catalogue-produits.json"
  );

  const data = JSON.parse(
    fs.readFileSync(file, "utf8")
  ) as { products: Product[] };

  const categories = [...new Set(
    data.products.map(p => p.category)
  )].sort();

  const q = (params.q || "").trim().toLowerCase();
  const category = params.category || "all";

  const filtered = data.products.filter(product => {
    if (
      category !== "all" &&
      product.category !== category
    ) return false;

    if (!q) return true;

    return [
      product.reference,
      product.title,
      product.category,
      product.subcategory
    ].join(" ").toLowerCase().includes(q);
  });

  const pageSize = 36;
  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / pageSize)
  );

  const requested = Number(params.page || "1");

  const currentPage = Number.isFinite(requested)
    ? Math.max(
        1,
        Math.min(totalPages, Math.floor(requested))
      )
    : 1;

  const visible = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  function href(page: number) {
    return "?" + new URLSearchParams({
      q,
      category,
      page: String(page)
    }).toString();
  }

  return (
    <main className="bg-slate-50 text-slate-950">
      <section className="border-b border-slate-200 bg-white py-10">
        <Container>
          <Link
            href="/catalogue"
            className="text-sm font-black text-[#007f8f]"
          >
            Catalogue OYSTE
          </Link>

          <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-orange-600">
            Manutention et équipements industriels
          </p>

          <h1 className="mt-2 text-4xl font-black">
            Catalogue STOCKMAN
          </h1>

          <p className="mt-3 text-slate-600">
            {data.products.length} références à découvrir.
          </p>
        </Container>
      </section>

      <section className="py-10">
        <Container>
          <form
            method="get"
            className="mb-8 flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4"
          >
            <input
              name="q"
              defaultValue={params.q || ""}
              placeholder="Rechercher une référence ou un produit"
              className="min-w-64 flex-1 rounded-xl border border-slate-200 px-4 py-3"
            />

            <select
              name="category"
              defaultValue={category}
              className="w-full min-w-0 max-w-full rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <option value="all">
                Toutes les catégories
              </option>

              {categories.map(item => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="rounded-xl bg-[#007f8f] px-6 py-3 font-black text-white"
            >
              Rechercher
            </button>
          </form>

          <p className="mb-6 text-sm font-bold text-slate-600">
            {filtered.length} références trouvées
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {visible.map(product => (
              <ProductCard
                key={product.reference}
                code={product.reference}
                name={product.title}
                family={product.category}
                price={formatStockmanSellingPrice(product.reference)}
                description={product.title}
                href={
                  "/catalogue/stockman/" +
                  encodeURIComponent(product.reference)
                }
                cta="Demander un devis"
                imageUrl={product.imageUrl}
                badge="STOCKMAN"
                documentCount={0}
              />
            ))}
          </div>

          <nav className="mt-10 flex items-center justify-between gap-4">
            {currentPage > 1 ? (
              <Link
                href={href(currentPage - 1)}
                className="font-black text-[#007f8f]"
              >
                Page précédente
              </Link>
            ) : <span />}

            <span className="text-sm font-bold text-slate-600">
              Page {currentPage} / {totalPages}
            </span>

            {currentPage < totalPages ? (
              <Link
                href={href(currentPage + 1)}
                className="font-black text-[#007f8f]"
              >
                Page suivante
              </Link>
            ) : <span />}
          </nav>
        </Container>
      </section>
    </main>
  );
}
