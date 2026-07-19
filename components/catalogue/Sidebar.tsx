import { cataloguePrinciples, guidanceSteps } from "@/data/catalogue";

export default function Sidebar() {
  return (
    <aside className="h-fit rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-orange-600">
        Logique catalogue
      </p>
      <h2 className="mt-3 text-xl font-black text-slate-950">
        Potences guidées, produits standards en catalogue.
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Les familles qui nécessitent un raisonnement commercial sont orientées vers l’assistant. Le reste du catalogue se parcourt comme un site industriel classique.
      </p>

      <div className="mt-6 grid gap-3">
        {cataloguePrinciples.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#007f8f]/10 text-[#005466]">
                  <Icon size={19} />
                </span>
                <span className="text-sm font-black text-slate-950">{item.title}</span>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-600">{item.text}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-orange-200 bg-orange-50 p-4">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-700">
          Parcours potence
        </p>
        <div className="mt-4 grid gap-2">
          {guidanceSteps.map((step, index) => (
            <div key={step} className="flex items-center gap-3 text-sm font-bold text-slate-800">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-600 text-xs font-black text-white">
                {index + 1}
              </span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>

      <a
        href="/configurateur"
        className="mt-6 inline-flex w-full justify-center rounded-xl bg-orange-600 px-5 py-4 text-sm font-black uppercase text-white transition hover:bg-orange-700"
      >
        Configurer une potence
      </a>
    </aside>
  );
}
