import { ArrowRight, CheckCircle2, ClipboardCheck, Settings, Wrench } from "lucide-react";
import Container from "@/components/ui/Container";
import SectionHeader from "@/components/ui/SectionHeader";

const services = [
  {
    icon: Settings,
    title: "Étude & dimensionnement",
    text: "Analyse du besoin, choix de la solution, cohérence charge / portée / fixation et accompagnement technique.",
  },
  {
    icon: Wrench,
    title: "Installation & mise en service",
    text: "Pose, réglages, essais et mise en service des équipements de levage et de manutention.",
  },
  {
    icon: ClipboardCheck,
    title: "Maintenance & conformité",
    text: "Suivi du matériel, entretien, contrôles et accompagnement sur la durée de vie de l'installation.",
  },
];

export default function ServicesPage() {
  return (
    <main className="bg-slate-50 text-slate-950">
      <section className="bg-white py-16">
        <Container className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <SectionHeader
            eyebrow="Services OYSTE"
            title="Un accompagnement industriel, de l'étude à la mise en service."
            text="Cette page pose la base des services : conseil, dimensionnement, installation, maintenance et suivi technique."
          />
          <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-8">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-600">
              Parcours client
            </p>
            <div className="mt-5 grid gap-3">
              {["Comprendre le besoin", "Choisir la bonne solution", "Installer et suivre le matériel"].map((step) => (
                <div key={step} className="flex items-center gap-3 rounded-2xl bg-white p-4 text-sm font-black text-slate-800">
                  <CheckCircle2 className="text-[#007f8f]" size={19} />
                  {step}
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section className="py-16">
        <Container className="grid gap-6 md:grid-cols-3">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <article key={service.title} className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#007f8f]/10 text-[#005466]">
                  <Icon size={28} />
                </div>
                <h2 className="mt-6 text-xl font-black text-slate-950">{service.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{service.text}</p>
              </article>
            );
          })}
        </Container>
      </section>

      <section className="bg-white py-16">
        <Container>
          <div className="rounded-[2rem] border border-orange-200 bg-orange-50 p-8 md:flex md:items-center md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-orange-700">Besoin concret</p>
              <h2 className="mt-2 text-3xl font-black text-slate-950">Passer par le configurateur potence</h2>
            </div>
            <a href="/configurateur" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-black uppercase text-white md:mt-0">
              Configurer <ArrowRight size={17} />
            </a>
          </div>
        </Container>
      </section>
    </main>
  );
}
