
import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import Container from "@/components/ui/Container";
import ProductMediaFrame from "@/components/catalogue/ProductMediaFrame";

export const dynamic = "force-dynamic";

type Product = {
  reference: string;
  title: string;
  category: string;
  subcategory: string;
  imageUrl: string;
  sourceUrl: string;
};

export default async function StockmanProductPage({
  params
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;

  const cataloguePath = path.join(
    process.cwd(),
    "data", "stockman", "catalogue-produits.json"
  );

  const catalogue = JSON.parse(
    fs.readFileSync(cataloguePath, "utf8")
  ) as { products: Product[] };

  const product = catalogue.products.find(
    item =>
      item.reference.toUpperCase() ===
      reference.toUpperCase()
  );

  if (!product) notFound();

  return (
    <main className="bg-slate-50 text-slate-950">
      <section className="border-b border-slate-200 bg-white py-6">
        <Container>
          <nav className="flex flex-wrap gap-2 text-sm font-bold text-slate-500">
            <Link href="/catalogue">
              Catalogue OYSTE
            </Link>
            <span>/</span>
            <Link href="/catalogue/stockman">
              STOCKMAN
            </Link>
            <span>/</span>
            <span className="text-slate-950">
              {product.reference}
            </span>
          </nav>
        </Container>
      </section>

      <section className="py-10 sm:py-14">
        <Container>
          <div className="grid gap-10 lg:grid-cols-2">
            <ProductMediaFrame
              src={product.imageUrl || ""}
              alt={product.title}
              label={product.reference}
              variant="card"
            />

            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-600">
                {product.category}
              </p>

              {product.subcategory ? (
                <p className="mt-2 text-sm font-bold text-[#007f8f]">
                  {product.subcategory}
                </p>
              ) : null}

              <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">
                {product.title}
              </h1>

              <p className="mt-4 text-sm font-bold text-slate-500">
                Référence : {product.reference}
              </p>

              <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
                <p className="text-2xl font-black">
                  Nous consulter
                </p>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Notre équipe vous accompagne dans le choix
                  de cet équipement et la préparation de votre devis.
                </p>

                <Link
                  href={
                    "/contact?reference=" +
                    encodeURIComponent(product.reference)
                  }
                  className="mt-6 inline-flex rounded-xl bg-[#007f8f] px-6 py-3 text-sm font-black text-white hover:bg-[#005466]"
                >
                  Demander un devis
                </Link>
              </div>

              <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-lg font-black">
                  Informations produit
                </h2>

                <dl className="mt-4 space-y-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Référence</dt>
                    <dd className="font-bold">{product.reference}</dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Fournisseur</dt>
                    <dd className="font-bold">STOCKMAN</dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Catégorie</dt>
                    <dd className="text-right font-bold">
                      {product.category}
                    </dd>
                  </div>

                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Disponibilité</dt>
                    <dd className="font-bold">À confirmer</dd>
                  </div>
                </dl>
              </div>

              <Link
                href="/catalogue/stockman"
                className="mt-8 inline-flex text-sm font-black text-[#007f8f]"
              >
                Retour au catalogue STOCKMAN
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
