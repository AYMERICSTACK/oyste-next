import { CreditCard, ShieldCheck, Truck } from "lucide-react";
import Container from "@/components/ui/Container";

export const metadata = {
  title: "Commande — OYSTE",
};

export default function CheckoutPage() {
  return (
    <main className="bg-slate-50 text-slate-950">
      <Container className="py-14">
        <section className="mx-auto max-w-4xl rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm lg:p-12">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-600">Commande sécurisée</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 md:text-5xl">
            Checkout OYSTE prêt à brancher
          </h1>
          <p className="mt-5 text-base font-bold leading-8 text-slate-600">
            Cette étape accueillera le formulaire client, l'adresse de livraison, le calcul transport final et le paiement sécurisé.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { icon: CreditCard, title: "Paiement", text: "Stripe ou solution bancaire à connecter." },
              { icon: Truck, title: "Transport", text: "Frais recalculés selon poids, volume et adresse." },
              { icon: ShieldCheck, title: "Validation", text: "Commande confirmée avec récapitulatif complet." },
            ].map((item) => (
              <div key={item.title} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                <item.icon className="text-[#007f8f]" size={24} />
                <h2 className="mt-4 text-lg font-black text-slate-950">{item.title}</h2>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>

          <a href="/panier" className="mt-8 inline-flex rounded-xl bg-orange-600 px-6 py-3 text-sm font-black uppercase text-white transition hover:bg-orange-700">
            Retour au panier
          </a>
        </section>
      </Container>
    </main>
  );
}
