import { formatStockmanSellingPrice } from "@/lib/catalogue/stockman-selling-prices";
import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import Container from "@/components/ui/Container";
import ProductDocuments from "@/components/catalogue/ProductDocuments";
import StockmanProductGallery from "@/components/catalogue/StockmanProductGallery";
import type { ProductDocument } from "@/lib/catalogue/repository";
import bcTechnical from "@/data/stockman/technical-bc.json";

export const dynamic = "force-dynamic";

type Product = { reference: string; title: string; category: string; subcategory: string; imageUrl: string; sourceUrl?: string };

export default async function StockmanProductPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const cataloguePath = path.join(process.cwd(), "data", "stockman", "catalogue-produits.json");
  const catalogue = JSON.parse(fs.readFileSync(cataloguePath, "utf8").replace(/^\uFEFF/, "")) as { products: Product[] };
  const product = catalogue.products.find(item => item.reference.toUpperCase() === reference.toUpperCase());
  if (!product) notFound();

  const code = product.reference.toUpperCase();
  const variant = bcTechnical.products[code as keyof typeof bcTechnical.products];
  // Les vues communes sont celles de la famille BC, et non des images de variantes concurrentes.
  const images = variant ? [variant.imageUrl, ...bcTechnical.gallery] : [product.imageUrl];
  const documents: ProductDocument[] = variant ? bcTechnical.documents.map(doc => ({
    kind: "technical-sheet", title: doc.title, description: "Documentation technique du fabricant",
    status: "available", href: doc.url, filename: doc.url.split("/").pop(), filetype: "pdf",
    reference: bcTechnical.family, isVisible: true,
  })) : [];

  return (
    <main className="bg-slate-50 text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <Container className="py-6 sm:py-8">
          <Link href="/catalogue" className="inline-flex items-center gap-2 text-sm font-black text-[#007f8f] hover:text-orange-600"><ArrowLeft size={17} /> Retour au catalogue</Link>
          <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">{product.category} · Réf. {code}</p>
              <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">{product.title}</h1>
            </div>
            <p className="text-lg font-black text-orange-600">{formatStockmanSellingPrice(product.reference)}</p>
          </div>
        </Container>
      </section>

      <Container className="py-7 lg:py-9">
        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 lg:grid-cols-[1.08fr_0.92fr]">
          <StockmanProductGallery images={images} title={product.title} reference={code} />
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-600">Votre produit</p>
            <h2 className="mt-2 text-lg font-black">{product.title}</h2>
            <p className="mt-1 text-sm font-bold text-slate-500">Référence : {code}</p>
            {variant ? (
              <div className="mt-5 rounded-2xl border border-[#007f8f]/25 bg-[#007f8f]/5 p-4">
                <h3 className="text-sm font-black uppercase tracking-wide text-[#005466]">Choisissez la capacité</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {bcTechnical.references.map(ref => (
                    <Link key={ref} href={`/catalogue/stockman/${ref}`} aria-current={ref === code ? "page" : undefined} className={`rounded-lg border px-3 py-2 text-xs font-black transition ${ref === code ? "border-[#007f8f] bg-[#007f8f] text-white" : "border-slate-200 bg-white text-slate-800 hover:border-[#007f8f]"}`}>
                      {bcTechnical.products[ref as keyof typeof bcTechnical.products].capacity}
                    </Link>
                  ))}
                </div>
                <p className="mt-3 text-xs font-bold text-slate-600">Capacité sélectionnée : {variant.capacity} · {code}</p>
              </div>
            ) : null}
            <div className="mt-5 rounded-2xl bg-slate-950 p-5 text-white">
              <p className="text-xs font-black uppercase tracking-widest text-slate-300">Prix HT</p>
              <p className="mt-2 text-2xl font-black text-orange-400">{formatStockmanSellingPrice(product.reference)}</p>
              <p className="mt-2 text-xs text-slate-300">Tarif de vente à confirmer. Aucun prix fournisseur n'est publié.</p>
            </div>
            <Link href={`/contact?reference=${encodeURIComponent(code)}`} className="mt-3 flex justify-center rounded-xl bg-orange-600 px-5 py-4 text-sm font-black text-white hover:bg-orange-700">Demander un devis</Link>
            {documents.length > 0 ? <a href="#documents-techniques" className="mt-3 flex justify-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-900 hover:border-[#007f8f]">Documents techniques ({documents.length})</a> : null}
          </div>
        </div>

        <section id="presentation-produit" className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
          <h2 className="text-2xl font-black">Description du produit</h2>
          <p className="mt-4 text-sm leading-7 text-slate-700">{product.title}</p>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="font-bold text-slate-500">Référence</dt><dd className="mt-1 font-black">{code}</dd></div>
            <div><dt className="font-bold text-slate-500">Fabricant</dt><dd className="mt-1 font-black">STOCKMAN</dd></div>
            {variant ? <div><dt className="font-bold text-slate-500">Capacité</dt><dd className="mt-1 font-black">{variant.capacity}</dd></div> : null}
            {product.subcategory ? <div><dt className="font-bold text-slate-500">Famille</dt><dd className="mt-1 font-black">{product.subcategory}</dd></div> : null}
          </dl>
        </section>
        <div className="mt-8"><ProductDocuments documents={documents} availableDocumentCount={documents.length} productName={product.title} /></div>
      </Container>
    </main>
  );
}
