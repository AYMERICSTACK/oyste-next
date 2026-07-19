const categories = [
  {
    title: "Levage",
    description: "Potences, palans, portiques, palonniers et accessoires.",
    href: "/catalogue/levage",
  },
  {
    title: "Manutention",
    description: "Gerbeurs, tables élévatrices, transpalettes et chariots.",
    href: "/catalogue/manutention-au-sol",
  },
  {
    title: "Motorisation SEW",
    description: "Motoréducteurs, variateurs et pièces industrielles.",
    href: "/catalogue/motorisation-sew",
  },
  {
    title: "Stockage",
    description: "Équipements de quai, cerclage, feuillards et emballage.",
    href: "/catalogue/stockage-emballage",
  },
];

export default function HomeCategories() {
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-orange-600">
            Nos univers
          </p>
          <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
            Trouvez rapidement le bon équipement industriel.
          </h2>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
            <a
              key={category.title}
              href={category.href}
              className="group rounded-[2rem] border border-slate-200 bg-slate-50 p-6 transition hover:-translate-y-1 hover:border-orange-500 hover:bg-white hover:shadow-xl"
            >
              <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-lg font-black text-white">
                {category.title.charAt(0)}
              </div>

              <h3 className="text-xl font-black text-slate-950">
                {category.title}
              </h3>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                {category.description}
              </p>

              <p className="mt-6 text-sm font-bold text-orange-600">
                Découvrir →
              </p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
