import { CheckCircle2, Download, ShoppingCart, SlidersHorizontal } from "lucide-react";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";

const variants = [
  { label: "125 kg / 2 m", price: 1131 },
  { label: "125 kg / 2,5 m", price: 1198 },
  { label: "125 kg / 3 m", price: 1275 },
  { label: "250 kg / 2 m", price: 1360 },
  { label: "500 kg / 3 m", price: 1890 },
];

const accessories = [
  { label: "Palan électrique KITO compatible", price: 785 },
  { label: "Ligne d’alimentation sur rail", price: 320 },
  { label: "Butées de rotation", price: 80 },
  { label: "Semelle de fixation", price: 260 },
];

export default function ProductPage() {
  const selectedVariant = variants[0];
  const selectedAccessories = accessories.slice(0, 2);
  const total =
    selectedVariant.price +
    selectedAccessories.reduce((sum, item) => sum + item.price, 0);

  return (
    <main className="bg-slate-50 text-slate-950">
      <Container className="grid gap-10 py-14 lg:grid-cols-[1fr_0.9fr]">
        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="aspect-[4/3] bg-slate-100">
            <img
              src="/images/hero-potence.png"
              alt="Potence sur fût inversée"
              className="h-full w-full object-cover object-center"
            />
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-600">
            PFI
          </p>
          <h1 className="mt-4 text-4xl font-black leading-tight text-slate-950">
            Potence sur fût inversée
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            Configurez la charge, la portée et les accessoires compatibles. Le
            prix se met à jour pour construire une solution directement commandable.
          </p>

          <div className="mt-8 rounded-3xl bg-slate-50 p-5">
            <div className="flex items-center gap-2 text-sm font-black text-[#005466]">
              <SlidersHorizontal size={18} /> Configuration rapide
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {variants.map((variant, index) => (
                <button
                  key={variant.label}
                  className={`rounded-2xl border bg-white px-4 py-4 text-left text-sm font-black transition hover:border-orange-500 ${
                    index === 0 ? "border-orange-500 ring-2 ring-orange-100" : "border-slate-200"
                  }`}
                >
                  <span>{variant.label}</span>
                  <span className="mt-1 block text-orange-600">
                    {variant.price.toLocaleString("fr-FR")} € HT
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-slate-500">
              Options compatibles
            </p>
            <div className="mt-4 grid gap-3">
              {accessories.map((item, index) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-700"
                >
                  <span className="flex items-center gap-3">
                    <CheckCircle2 size={18} className="text-[#007f8f]" /> {item.label}
                  </span>
                  <span className="font-black text-slate-950">
                    + {item.price.toLocaleString("fr-FR")} € HT
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between text-sm font-black text-slate-600">
              <span>Configuration sélectionnée</span>
              <span>Prix HT</span>
            </div>
            <div className="mt-4 space-y-2 text-sm font-bold text-slate-700">
              <div className="flex justify-between">
                <span>{selectedVariant.label}</span>
                <span>{selectedVariant.price.toLocaleString("fr-FR")} €</span>
              </div>
              {selectedAccessories.map((item) => (
                <div key={item.label} className="flex justify-between">
                  <span>{item.label}</span>
                  <span>{item.price.toLocaleString("fr-FR")} €</span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-5">
              <span className="font-black uppercase text-slate-950">Total</span>
              <span className="text-3xl font-black text-orange-600">
                {total.toLocaleString("fr-FR")} € HT
              </span>
            </div>
          </div>

          <div className="mt-9 flex flex-wrap gap-4">
            <Button href="/panier">
              Ajouter au panier <ShoppingCart size={18} />
            </Button>
            <Button href="#" variant="ghost">
              Fiche technique <Download size={18} />
            </Button>
          </div>
        </div>
      </Container>
    </main>
  );
}
