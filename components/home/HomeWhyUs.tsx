const items = [
  "Des solutions adaptées aux environnements industriels",
  "Un accompagnement technique avant achat",
  "Des équipements, accessoires et prestations complémentaires",
  "Une plateforme pensée pour guider vos choix",
];

export default function HomeWhyUs() {
  return (
    <section className="bg-slate-50 py-24">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-2">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-orange-600">
            Pourquoi OYSTE
          </p>

          <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
            Vous ne cherchez pas seulement un produit, mais la bonne solution.
          </h2>

          <p className="mt-6 text-lg leading-8 text-slate-600">
            Le levage industriel nécessite de prendre en compte la charge, la
            portée, la fixation, l’environnement, les accessoires et parfois la
            pose. Notre objectif est de rendre ce choix plus simple et plus sûr.
          </p>
        </div>

        <div className="grid gap-4">
          {items.map((item) => (
            <div
              key={item}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <p className="font-bold text-slate-950">✓ {item}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
