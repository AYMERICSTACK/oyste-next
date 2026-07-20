import { CheckCircle2, Clock3, Factory, PackageCheck, Phone, ShieldCheck, Truck } from "lucide-react";
import Container from "@/components/ui/Container";
import { getCmsContent } from "@/lib/cms";

const modes = [
  { icon: CheckCircle2, title: "Livraison comprise", text: "Pour certaines références, les frais de transport sont directement compris dans le prix présenté. Cette information est indiquée clairement dans le panier et dans la confirmation de commande." },
  { icon: PackageCheck, title: "Expédition standard", text: "Les équipements compatibles avec une expédition standard sont pris en charge selon leur poids, leurs dimensions et leur destination." },
  { icon: Truck, title: "Transport spécialisé", text: "Les produits lourds, longs ou volumineux font l’objet d’une solution de transport adaptée aux contraintes du matériel et du site de livraison." },
  { icon: Factory, title: "Équipements sur mesure", text: "Les solutions configurées ou fabriquées à la demande bénéficient d’une étude logistique dédiée afin de sécuriser leur acheminement." },
];

const faq = [
  ["Comment la solution de livraison est-elle choisie ?", "Elle dépend de la nature des produits, de leur poids, de leurs dimensions, des quantités commandées et de l’adresse de destination."],
  ["Pourquoi un code postal est-il demandé ?", "Il permet d’identifier la destination et de déterminer les solutions de transport disponibles pour votre commande."],
  ["Quand le montant de la livraison est-il communiqué ?", "Le montant disponible est affiché dans le panier. Lorsqu’une étude complémentaire est nécessaire, le prix définitif est précisé dans la confirmation de commande ou dans le devis transmis par l’équipe OYSTE."],
  ["Une commande peut-elle utiliser plusieurs solutions de transport ?", "Oui. Selon les produits sélectionnés, plusieurs modes de livraison peuvent être combinés afin de proposer la solution la plus adaptée à chaque équipement."],
  ["Puis-je retirer ma commande ?", "Un enlèvement peut être organisé selon la disponibilité, le lieu de préparation et la nature des produits. Notre équipe vous confirme les modalités avant le retrait."],
];

export default async function LivraisonPage() {
  const { editorial } = await getCmsContent();
  return (
    <main className="bg-slate-50 text-slate-950">
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.28),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(0,127,143,0.3),transparent_38%)]" />
        <Container className="relative py-16 lg:py-24">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-orange-300">Livraison industrielle OYSTE</p>
          <h1 className="mt-5 max-w-5xl text-4xl font-black tracking-tight md:text-6xl">{editorial.deliveryTitle}</h1>
          <p className="mt-6 max-w-3xl text-base font-bold leading-8 text-slate-300">{editorial.deliveryIntro}</p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm font-black">
            <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2">Solutions adaptées aux équipements</span>
            <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2">Prix précisé avant validation</span>
            <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2">Accompagnement par un spécialiste</span>
          </div>
        </Container>
      </section>

      <Container className="py-12 lg:py-16">
        <section className="grid gap-5 md:grid-cols-2">
          {modes.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#007f8f]/10 text-[#007f8f]"><Icon size={24} /></div>
              <h2 className="mt-5 text-2xl font-black">{title}</h2>
              <p className="mt-3 text-sm font-bold leading-7 text-slate-600">{text}</p>
            </article>
          ))}
        </section>

        <section className="mt-10 rounded-[2.5rem] bg-slate-950 p-7 text-white lg:p-10">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-300">Comment ça fonctionne</p>
          <div className="mt-7 grid gap-4 md:grid-cols-4">
            {["Produits sélectionnés", "Poids et dimensions", "Adresse de livraison", "Solution et prix confirmés"].map((step, index) => (
              <div key={step} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <span className="text-sm font-black text-orange-300">0{index + 1}</span>
                <p className="mt-3 font-black">{step}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_0.7fr]">
          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-7 shadow-sm lg:p-9">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-[#007f8f]">Questions fréquentes</p>
            <div className="mt-6 divide-y divide-slate-200">
              {faq.map(([question, answer]) => (
                <details key={question} className="group py-5">
                  <summary className="cursor-pointer list-none text-lg font-black">{question}</summary>
                  <p className="mt-3 text-sm font-bold leading-7 text-slate-600">{answer}</p>
                </details>
              ))}
            </div>
          </div>
          <aside className="rounded-[2.5rem] bg-orange-600 p-7 text-white lg:p-9">
            <ShieldCheck size={34} />
            <h2 className="mt-5 text-3xl font-black">Une logistique adaptée au terrain</h2>
            <div className="mt-6 grid gap-4 text-sm font-bold leading-6">
              <p className="flex gap-3"><Clock3 className="shrink-0" size={20} /> Délais précisés selon la disponibilité, la préparation et la destination.</p>
              <p className="flex gap-3"><Truck className="shrink-0" size={20} /> Transport adapté aux produits lourds, longs, volumineux ou sur mesure.</p>
              <p className="flex gap-3"><Phone className="shrink-0" size={20} /> Validation par un spécialiste lorsque votre commande nécessite une étude particulière.</p>
            </div>
            <a href="/contact" className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-white px-5 py-4 text-sm font-black uppercase text-orange-700">Parler à un spécialiste</a>
          </aside>
        </section>
      </Container>
    </main>
  );
}
