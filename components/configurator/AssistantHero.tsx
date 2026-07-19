import { ArrowRight, BadgeCheck, ShoppingCart } from "lucide-react";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";

export default function AssistantHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-white via-slate-50 to-slate-100">
      <div className="absolute right-0 top-0 hidden h-full w-1/2 bg-[radial-gradient(circle_at_center,rgba(0,127,143,0.12),transparent_62%)] lg:block" />

      <Container className="relative grid gap-10 py-16 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.35em] text-orange-600">
            Assistant de sélection OYSTE
          </p>
          <h1 className="mt-5 max-w-4xl text-5xl font-black leading-[0.98] tracking-tight text-slate-950 md:text-6xl">
            Décrivez votre besoin. Le site construit votre solution.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Charge, portée, environnement, fixation, palan et accessoires : chaque
            choix met à jour votre installation et son prix HT en temps réel.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Button href="#assistant">
              Démarrer l’assistant <ArrowRight size={18} />
            </Button>
            <Button href="/catalogue/levage" variant="secondary">
              Parcourir les familles <ShoppingCart size={18} />
            </Button>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-200/70">
          <div className="rounded-[1.5rem] bg-slate-50 p-6">
            <div className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.22em] text-[#007f8f]">
              <BadgeCheck size={18} /> Exemple de résultat
            </div>
            <div className="mt-8 space-y-4">
              {[
                ["Potence adaptée", "Prix HT estimé"],
                ["Palan compatible", "Inclus selon configuration"],
                ["Alimentation et commande", "Option disponible"],
              ].map(([label, price]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm"
                >
                  <span className="font-black text-slate-950">{label}</span>
                  <span className="font-black text-orange-600">{price}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl bg-slate-950 p-5 text-white">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-400">Total instantané</p>
                  <p className="mt-1 text-3xl font-black">2 346,00 € HT</p>
                </div>
                <ShoppingCart className="text-orange-500" size={30} />
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
