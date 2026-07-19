"use client";

import { ArrowRight, CheckCircle2, Minus, PackageCheck, Plus, RotateCcw, ShieldCheck, Trash2, Truck, Wrench } from "lucide-react";
import Container from "@/components/ui/Container";
import { formatCartPrice, useCart } from "@/lib/cart/cart-store";

type CartSuggestion = {
  title: string;
  description: string;
  href: string;
};

const defaultSuggestions: CartSuggestion[] = [
  {
    title: "Palan",
    description: "Ajoutez une solution de levage adaptée à votre installation.",
    href: "/catalogue/levage?famille=palan",
  },
  {
    title: "Accessoires de levage",
    description: "Complétez votre commande avec les accessoires courants.",
    href: "/catalogue/levage?famille=accessoires-de-levage",
  },
  {
    title: "Transpalette",
    description: "Ajoutez la manutention au sol à votre commande atelier.",
    href: "/catalogue/manutention-au-sol?famille=transpalette",
  },
];

function getCartSuggestions(items: ReturnType<typeof useCart>["items"]): CartSuggestion[] {
  const cartText = items.map((item) => `${item.name} ${item.family} ${item.code}`).join(" ").toLowerCase();

  if (!cartText) return defaultSuggestions;

  if (cartText.includes("potence") || cartText.includes("portique")) {
    return [
      { title: "Palan", description: "Le complément naturel pour rendre l'installation opérationnelle.", href: "/catalogue/levage?famille=palan" },
      { title: "Chariot porte-palan", description: "À associer selon le type de palan et le profil de roulement.", href: "/catalogue/levage?famille=palan" },
      { title: "Accessoires de levage", description: "Crochets, élingues et accessoires pour finaliser le poste.", href: "/catalogue/levage?famille=accessoires-de-levage" },
    ];
  }

  if (cartText.includes("palan")) {
    return [
      { title: "Chariot porte-palan", description: "Déplacement manuel ou par chaîne selon votre usage.", href: "/catalogue/levage?famille=palan" },
      { title: "Potence sur fût", description: "Créez un poste de levage complet autour du palan.", href: "/catalogue/levage?famille=potence-sur-fut" },
      { title: "Portique", description: "Solution mobile ou fixe pour compléter le palan.", href: "/catalogue/levage?famille=portique" },
    ];
  }

  if (cartText.includes("transpalette") || cartText.includes("gerbeur") || cartText.includes("diable")) {
    return [
      { title: "Chariot et servante", description: "Optimisez les déplacements et l'organisation en atelier.", href: "/catalogue/manutention-au-sol?famille=chariot-et-servante" },
      { title: "Table élévatrice", description: "Travaillez à hauteur et réduisez les efforts de manutention.", href: "/catalogue/manutention-au-sol?famille=table-elevatrice" },
      { title: "Cric et vérin", description: "Compléments utiles pour les opérations de maintenance.", href: "/catalogue/manutention-au-sol?famille=cric-et-verin" },
    ];
  }

  return defaultSuggestions;
}

export default function CartPageClient() {
  const { items, totals, updateQuantity, removeItem, clearCart } = useCart();
  const hasItems = items.length > 0;
  const suggestedProducts = getCartSuggestions(items);

  return (
    <main className="bg-slate-50 text-slate-950">
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.28),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(0,127,143,0.25),transparent_36%)]" />
        <Container className="relative py-12 lg:py-16">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-orange-300">Panier OYSTE</p>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-black tracking-tight md:text-6xl">Votre commande industrielle</h1>
              <p className="mt-4 max-w-3xl text-base font-bold leading-8 text-slate-300">
                Regroupez produits catalogue et solutions configurées dans un panier unique avant validation et paiement.
              </p>
            </div>
            <div className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-white/10 p-4 text-sm font-black backdrop-blur sm:grid-cols-3 lg:min-w-[470px]">
              <div>
                <p className="text-slate-400">Articles</p>
                <p className="mt-1 text-2xl text-white">{totals.itemCount}</p>
              </div>
              <div>
                <p className="text-slate-400">Sous-total HT</p>
                <p className="mt-1 text-2xl text-orange-300">{formatCartPrice(totals.subtotalHT)}</p>
              </div>
              <div>
                <p className="text-slate-400">Livraison</p>
                <p className="mt-1 text-2xl text-white">{totals.estimatedShippingHT === 0 && totals.subtotalHT > 0 ? "Offerte" : formatCartPrice(totals.estimatedShippingHT)}</p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <Container className="py-10 lg:py-14">
        {!hasItems ? (
          <section className="rounded-[2.5rem] border border-slate-200 bg-white p-8 text-center shadow-sm lg:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
              <PackageCheck size={30} />
            </div>
            <h2 className="mt-5 text-3xl font-black text-slate-950">Votre panier est vide</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-bold leading-7 text-slate-600">
              Ajoutez un produit catalogue ou configurez une potence pour commencer votre commande.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <a href="/catalogue" className="inline-flex items-center justify-center rounded-xl bg-orange-600 px-6 py-3 text-sm font-black uppercase text-white transition hover:bg-orange-700">
                Parcourir le catalogue <ArrowRight size={17} />
              </a>
              <a href="/configurateur" className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-black uppercase text-slate-950 transition hover:border-[#007f8f] hover:text-[#007f8f]">
                Configurer une potence
              </a>
            </div>
          </section>
        ) : (
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_420px]">
            <section className="grid gap-5">
              {items.map((item) => (
                <article key={item.id} className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
                  <div className="grid gap-5 p-5 md:grid-cols-[150px_minmax(0,1fr)_180px] md:p-6">
                    <div className="flex aspect-square items-center justify-center overflow-hidden rounded-[1.5rem] bg-slate-100">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="h-full w-full object-contain p-4" />
                      ) : (
                        <PackageCheck className="text-slate-400" size={42} />
                      )}
                    </div>

                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-[#007f8f]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#005466]">
                          {item.kind === "configured" ? "Configuré" : "Catalogue"}
                        </span>
                        {item.family ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                            {item.family}
                          </span>
                        ) : null}
                      </div>

                      <h2 className="mt-3 text-2xl font-black leading-tight text-slate-950">{item.name}</h2>
                      {item.code ? <p className="mt-1 text-sm font-bold text-slate-500">Référence : {item.code}</p> : null}
                      {item.delay ? <p className="mt-3 text-sm font-black text-[#007f8f]">{item.delay}</p> : null}

                      {item.technicalLines?.length ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {item.technicalLines.slice(0, 8).map((line) => (
                            <span key={`${item.id}-${line.label}`} className="rounded-full bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                              <span className="font-black text-slate-950">{line.label}</span> : {line.value}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-5 flex flex-wrap gap-3 text-sm font-black">
                        {item.href ? <a href={item.href} className="text-[#007f8f] hover:text-[#005466]">Voir la fiche</a> : null}
                        {item.editHref ? <a href={item.editHref} className="text-orange-600 hover:text-orange-700">Modifier la configuration</a> : null}
                      </div>
                    </div>

                    <div className="flex flex-col justify-between gap-5 rounded-[1.5rem] bg-slate-50 p-4">
                      <div className="text-right md:text-left lg:text-right">
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Prix HT</p>
                        <p className="mt-2 text-2xl font-black text-orange-600">{formatCartPrice(item.unitPriceHT)}</p>
                      </div>

                      <div className="flex items-center justify-between gap-3 rounded-2xl bg-white p-2">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:border-orange-500 hover:text-orange-600"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="text-lg font-black">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:border-orange-500 hover:text-orange-600"
                        >
                          <Plus size={16} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-slate-950">Total : {formatCartPrice(item.unitPriceHT * item.quantity)}</p>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-500 transition hover:text-red-600"
                          aria-label="Supprimer"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}

              <button type="button" onClick={clearCart} className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black uppercase text-slate-600 transition hover:border-red-200 hover:text-red-600">
                <RotateCcw size={17} /> Vider le panier
              </button>
            </section>

            <aside className="h-fit rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-28">
              <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-600">Récapitulatif</p>
              <div className="mt-5 space-y-3 text-sm font-bold text-slate-600">
                <div className="flex justify-between gap-4"><span>Sous-total HT</span><span className="font-black text-slate-950">{formatCartPrice(totals.subtotalHT)}</span></div>
                <div className="flex justify-between gap-4"><span>Transport estimatif HT</span><span className="font-black text-slate-950">{totals.estimatedShippingHT === 0 ? "Offert" : formatCartPrice(totals.estimatedShippingHT)}</span></div>
                <div className="flex justify-between gap-4"><span>TVA estimée</span><span className="font-black text-slate-950">{formatCartPrice(totals.vat)}</span></div>
              </div>
              <div className="mt-5 border-t border-slate-200 pt-5">
                <div className="flex items-end justify-between gap-4">
                  <span className="text-sm font-black uppercase text-slate-500">Total TTC</span>
                  <span className="text-3xl font-black text-slate-950">{formatCartPrice(totals.totalTTC)}</span>
                </div>
              </div>

              <a href="/commande" className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-xl bg-orange-600 px-6 py-4 text-sm font-black uppercase text-white shadow-xl shadow-orange-600/20 transition hover:bg-orange-700">
                Commander <ArrowRight size={18} />
              </a>
              <p className="mt-3 text-xs font-bold leading-5 text-slate-500">
                Le paiement en ligne pourra être branché ensuite. Les frais de transport définitifs pourront être recalculés au checkout.
              </p>

              <div className="mt-6 grid gap-3 text-sm font-bold text-slate-700">
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4"><ShieldCheck className="mt-0.5 text-[#007f8f]" size={19} /> Paiement sécurisé à brancher</div>
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4"><Truck className="mt-0.5 text-[#007f8f]" size={19} /> Transport industriel estimé</div>
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4"><Wrench className="mt-0.5 text-[#007f8f]" size={19} /> Produits configurés modifiables</div>
              </div>
            </aside>
          </div>
        )}

        <section className="mt-10 rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.25em] text-[#007f8f]">Cross selling intelligent</p>
              <h2 className="mt-2 text-3xl font-black text-slate-950">Complétez votre commande</h2>
            </div>
            <a href="/catalogue" className="text-sm font-black text-orange-600">Voir tout le catalogue →</a>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {suggestedProducts.map((product) => (
              <a key={product.title} href={product.href} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-1 hover:border-[#007f8f]/30 hover:bg-white hover:shadow-lg">
                <CheckCircle2 className="text-[#007f8f]" size={23} />
                <h3 className="mt-4 text-lg font-black text-slate-950">{product.title}</h3>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-600">{product.description}</p>
              </a>
            ))}
          </div>
        </section>
      </Container>
    </main>
  );
}
