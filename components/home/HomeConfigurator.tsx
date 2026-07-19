export default function HomeConfigurator() {
  const items = [
    { label: "Potence PFI", price: "1 131 € HT" },
    { label: "Palan KITO compatible", price: "785 € HT" },
    { label: "Ligne d’alimentation", price: "320 € HT" },
  ];

  return (
    <section className="bg-slate-950 py-24 text-white">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-2">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-orange-500">
            Configuration en ligne
          </p>

          <h2 className="mt-4 text-4xl font-black tracking-tight">
            Configurez votre solution et voyez le prix en direct.
          </h2>

          <p className="mt-6 text-lg leading-8 text-slate-300">
            Charge, portée, fixation, palan, alimentation et accessoires : chaque
            choix met à jour votre configuration pour passer commande simplement.
          </p>

          <a
            href="/configurateur"
            className="mt-8 inline-flex rounded-full bg-orange-600 px-7 py-4 text-sm font-bold text-white hover:bg-orange-700"
          >
            Commencer la configuration
          </a>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <div className="rounded-3xl bg-white p-6 text-slate-950">
            <p className="text-sm font-bold text-orange-600">Votre solution</p>
            <h3 className="mt-2 text-2xl font-black">
              Potence prête à commander
            </h3>

            <div className="mt-6 grid gap-3">
              {items.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-sm font-bold"
                >
                  <span>{item.label}</span>
                  <span className="text-[#007f8f]">{item.price}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl bg-slate-100 p-4">
              <div className="flex items-center justify-between text-sm font-black text-slate-950">
                <span>Total estimé</span>
                <span className="text-xl text-orange-600">2 236 € HT</span>
              </div>
              <button className="mt-4 w-full rounded-xl bg-orange-600 px-5 py-4 text-sm font-black uppercase text-white">
                Ajouter au panier
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
