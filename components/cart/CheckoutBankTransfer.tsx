"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CalendarDays, CheckCircle2, CreditCard, Loader2, MapPin, ShieldCheck, Truck } from "lucide-react";
import { formatCartPrice, useCart } from "@/lib/cart/cart-store";
import { calculateCartShipping } from "@/lib/shipping";

type Customer = { firstName: string | null; lastName: string | null; company: string | null; email: string; phone: string | null };
export default function CheckoutBankTransfer({ customer }: { customer: Customer }) {
  const router = useRouter();
  const { items, clearCart } = useCart();
  const [form, setForm] = useState({ company: customer.company || "", firstName: customer.firstName || "", lastName: customer.lastName || "", address1: "", address2: "", postalCode: "", city: "", country: "FR", requestedDate: "", customerNote: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const shipping = calculateCartShipping(items, form.postalCode);
  const subtotalHt = items.reduce((sum, item) => sum + item.unitPriceHT * item.quantity, 0);
  const shippingHt = shipping.hasQuote ? 0 : shipping.confirmedAmountHT;
  const totalTtc = (subtotalHt + shippingHt) * 1.2;
  function update(name: keyof typeof form, value: string) { setForm((current) => ({ ...current, [name]: value })); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (!items.length) { setError("Votre panier est vide."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/orders/bank-transfer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items, address: { company: form.company, firstName: form.firstName, lastName: form.lastName, address1: form.address1, address2: form.address2, postalCode: form.postalCode, city: form.city, country: form.country }, requestedDate: form.requestedDate, customerNote: form.customerNote }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Impossible d’enregistrer la commande.");
      clearCart();
      router.push(`/commande/confirmation/${result.id}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Une erreur est survenue."); }
    finally { setLoading(false); }
  }
  if (!items.length) return <div className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center shadow-sm"><CheckCircle2 className="mx-auto text-[#007f8f]" size={38}/><h2 className="mt-4 text-2xl font-black">Votre panier est vide</h2><a href="/catalogue" className="mt-6 inline-flex rounded-xl bg-orange-600 px-6 py-3 text-sm font-black uppercase text-white">Retour au catalogue</a></div>;
  return <form onSubmit={submit} className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_420px]">
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#007f8f]/10 text-[#007f8f]"><MapPin size={22}/></span><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#007f8f]">Livraison</p><h2 className="text-2xl font-black">Adresse de livraison</h2></div></div><div className="mt-6 grid gap-4 md:grid-cols-2">
        {[{n:"company",l:"Société"},{n:"firstName",l:"Prénom"},{n:"lastName",l:"Nom"},{n:"address1",l:"Adresse"},{n:"address2",l:"Complément d’adresse",optional:true},{n:"postalCode",l:"Code postal"},{n:"city",l:"Ville"}].map((field) => <label key={field.n} className={field.n === "address1" || field.n === "address2" ? "md:col-span-2" : ""}><span className="text-xs font-black uppercase tracking-wide text-slate-500">{field.l}</span><input required={!field.optional} value={form[field.n as keyof typeof form]} onChange={(e)=>update(field.n as keyof typeof form,e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none transition focus:border-[#007f8f] focus:bg-white" /></label>)}
      </div></section>
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8"><div className="flex items-center gap-3"><CalendarDays className="text-[#007f8f]"/><h2 className="text-xl font-black">Informations complémentaires</h2></div><div className="mt-5 grid gap-4"><label><span className="text-xs font-black uppercase tracking-wide text-slate-500">Date souhaitée <span className="normal-case font-medium">(facultatif)</span></span><input value={form.requestedDate} onChange={(e)=>update("requestedDate",e.target.value)} placeholder="Ex. semaine 38" className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-[#007f8f]" /></label><label><span className="text-xs font-black uppercase tracking-wide text-slate-500">Message pour notre équipe <span className="normal-case font-medium">(facultatif)</span></span><textarea value={form.customerNote} onChange={(e)=>update("customerNote",e.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-[#007f8f]" /></label></div></section>
      <section className="rounded-[2rem] border-2 border-[#007f8f] bg-white p-6 shadow-sm md:p-8"><div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#007f8f] text-white"><CreditCard size={23}/></span><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#007f8f]">Mode de paiement</p><h2 className="mt-1 text-2xl font-black">Virement bancaire</h2><p className="mt-2 text-sm font-bold leading-6 text-slate-600">Les coordonnées bancaires et votre référence OYSTE unique seront affichées après validation et envoyées par e-mail.</p></div></div></section>
    </div>
    <aside className="h-fit rounded-[2rem] bg-[#071827] p-6 text-white shadow-xl xl:sticky xl:top-28"><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">Récapitulatif</p><div className="mt-5 space-y-4">{items.map((item)=><div key={item.id} className="flex justify-between gap-4 border-b border-white/10 pb-4"><div><p className="text-sm font-black">{item.name}</p><p className="mt-1 text-xs text-slate-400">Qté {item.quantity}</p></div><strong className="text-sm">{formatCartPrice(item.unitPriceHT*item.quantity)}</strong></div>)}</div><div className="mt-5 space-y-3 text-sm"><div className="flex justify-between text-slate-300"><span>Sous-total HT</span><strong className="text-white">{formatCartPrice(subtotalHt)}</strong></div><div className="flex justify-between text-slate-300"><span>Livraison HT</span><strong className="text-white">{shipping.hasQuote ? "À confirmer" : formatCartPrice(shippingHt)}</strong></div><div className="flex justify-between border-t border-white/15 pt-4 text-lg"><span className="font-black">Total TTC</span><strong className="text-2xl text-cyan-300">{formatCartPrice(totalTtc)}</strong></div>{shipping.hasQuote && <p className="rounded-xl bg-orange-500/15 p-3 text-xs font-bold leading-5 text-orange-100">Le transport nécessite une étude. Ne réalisez aucun virement avant la confirmation définitive de notre équipe.</p>}</div>{error && <p className="mt-4 rounded-xl bg-red-500/15 p-3 text-sm font-bold text-red-100">{error}</p>}<button disabled={loading} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-4 text-sm font-black uppercase text-white transition hover:bg-orange-500 disabled:opacity-60">{loading?<><Loader2 className="animate-spin" size={18}/>Enregistrement…</>:<>Confirmer la commande <ShieldCheck size={18}/></>}</button><div className="mt-5 space-y-3 text-xs font-bold text-slate-300"><p className="flex items-start gap-2"><Building2 size={16} className="mt-0.5 text-cyan-300"/>Compte bancaire professionnel sécurisé</p><p className="flex items-start gap-2"><Truck size={16} className="mt-0.5 text-cyan-300"/>Préparation après validation du règlement</p></div></aside>
  </form>;
}
