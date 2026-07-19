import { Mail, MapPin, Phone } from "lucide-react";
import Container from "@/components/ui/Container";
import SectionHeader from "@/components/ui/SectionHeader";

const contacts = [
  { icon: Phone, label: "Téléphone", value: "04 00 00 00 00", href: "tel:+33400000000" },
  { icon: Mail, label: "Email", value: "contact@oyste.fr", href: "mailto:contact@oyste.fr" },
  { icon: MapPin, label: "Zone", value: "France & Europe", href: null },
];

export default function ContactPage() {
  return (
    <main className="bg-slate-50 text-slate-950">
      <section className="bg-white py-16">
        <Container className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <SectionHeader
            eyebrow="Contact"
            title="Échanger avec OYSTE sur votre besoin industriel."
            text="Page de contact provisoire prête pour brancher ensuite un formulaire, Resend et les données commerciales réelles."
          />
          <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-8">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-600">Horaires</p>
            <p className="mt-3 text-2xl font-black text-slate-950">Lun - Ven : 8h00 - 17h30</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">Demande catalogue, configurateur, étude potence ou projet spécifique.</p>
          </div>
        </Container>
      </section>
      <section className="py-16">
        <Container className="grid gap-6 md:grid-cols-3">
          {contacts.map((item) => {
            const Icon = item.icon;
            const content = (
              <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:border-orange-500 hover:shadow-xl">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#007f8f]/10 text-[#005466]">
                  <Icon size={28} />
                </div>
                <p className="mt-6 text-sm font-black uppercase tracking-[0.18em] text-orange-600">{item.label}</p>
                <h2 className="mt-2 text-xl font-black text-slate-950">{item.value}</h2>
              </article>
            );
            return item.href ? <a key={item.label} href={item.href}>{content}</a> : <div key={item.label}>{content}</div>;
          })}
        </Container>
      </section>
    </main>
  );
}
