const products = [
  {
    code: "PFI",
    name: "Potence sur fût inversée",
    description: "Solution robuste pour poste de travail industriel.",
    category: "Levage",
  },
  {
    code: "PORT",
    name: "Portique d’atelier",
    description: "Déplacement et levage de charges en atelier.",
    category: "Levage",
  },
  {
    code: "PALFIX",
    name: "Palan électrique fixe",
    description: "Levage motorisé pour charges industrielles.",
    category: "Palans",
  },
];

export default function HomeFeaturedProducts() {
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-orange-600">
              Produits phares
            </p>
            <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
              Les équipements les plus recherchés.
            </h2>
          </div>

          <a
            href="/catalogue"
            className="text-sm font-black text-orange-600 hover:text-orange-700"
          >
            Voir tout le catalogue →
          </a>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {products.map((product) => (
            <a
              key={product.code}
              href={`/produit/${product.code.toLowerCase()}`}
              className="group overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-50 transition hover:-translate-y-1 hover:border-orange-500 hover:bg-white hover:shadow-xl"
            >
              <div className="aspect-[4/3] bg-gradient-to-br from-slate-200 to-slate-100" />

              <div className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <p className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">
                    {product.code}
                  </p>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                    {product.category}
                  </p>
                </div>

                <h3 className="mt-5 text-xl font-black text-slate-950">
                  {product.name}
                </h3>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {product.description}
                </p>

                <p className="mt-6 text-sm font-black text-orange-600">
                  Configurer →
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
