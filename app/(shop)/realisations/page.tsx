import { ArrowRight, Factory, Hammer, ShieldCheck } from "lucide-react";
import Container from "@/components/ui/Container";
import SectionHeader from "@/components/ui/SectionHeader";

const items = [
  { icon: Factory, title: "Atelier industriel", text: "Implantation d'une solution de levage adaptée aux postes de production." },
  { icon: Hammer, title: "Poste de maintenance", text: "Équipement d'une zone technique avec matériel de levage et accessoires." },
  { icon: ShieldCheck, title: "Sécurisation de poste", text: "Optimisation de la manutention et réduction des efforts opérateurs." },
];

export default function RealisationsPage() {
  return (
    <main className="bg-slate-50 text-slate-950">
      <section className="bg-white py-16">
        <Container>
          <SectionHeader
            eyebrow="Réalisations"
            title="Des cas clients à structurer progressivement."
            text="La page est maintenant accessible depuis le header. On pourra ensuite y ajouter les vraies photos chantier, fiches projets et avant/après."
          />
        </Container>
      </section>
      <section className="py-16">
        <Container className="grid gap-6 md:grid-cols-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#007f8f]/10 text-[#005466]">
                  <Icon size={28} />
                </div>
                <h2 className="mt-6 text-xl font-black text-slate-950">{item.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.text}</p>
              </article>
            );
          })}
        </Container>
      </section>
      <section className="bg-white py-16">
        <Container>
          <a href="/catalogue" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black uppercase text-white">
            Voir le catalogue <ArrowRight size={17} />
          </a>
        </Container>
      </section>
    </main>
  );
}
