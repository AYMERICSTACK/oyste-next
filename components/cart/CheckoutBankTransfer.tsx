"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckCircle2, Loader2, MapPin, ShieldCheck, Truck } from "lucide-react";
import { formatCartPrice, useCart } from "@/lib/cart/cart-store";
import { useShippingQuote } from "@/lib/cart/use-shipping-quote";
import { useKitoAdjustment } from "@/lib/cart/use-kito-adjustment";

type Customer = { firstName: string | null; lastName: string | null; company: string | null; email: string; phone: string | null };
type BillingAddress = { company: string | null; firstName: string | null; lastName: string | null; address1: string; address2: string | null; postalCode: string; city: string; country: string } | null;
export default function CheckoutBankTransfer({ customer, billingAddress }: { customer: Customer; billingAddress: BillingAddress }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { items, clearCart } = useCart();
  const [form, setForm] = useState({ company: billingAddress?.company || customer.company || "", firstName: billingAddress?.firstName || customer.firstName || "", lastName: billingAddress?.lastName || customer.lastName || "", address1: billingAddress?.address1 || "", address2: billingAddress?.address2 || "", postalCode: billingAddress?.postalCode || "", city: billingAddress?.city || "", country: billingAddress?.country || "FR", requestedDate: "", customerNote: "" });
  const [loading, setLoading] = useState(false);
  const [useBillingAddress, setUseBillingAddress] = useState(Boolean(billingAddress));
  const [paymentMethod, setPaymentMethod] = useState<"CARD" | "BANK_TRANSFER" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedPostcode = sessionStorage.getItem("oyste-checkout-postcode") || "";
    if (/^\d{5}$/.test(savedPostcode)) {
      setForm((current) => current.postalCode ? current : { ...current, postalCode: savedPostcode });
    }
  }, []);

  const { shipping, loading: shippingLoading } = useShippingQuote(items, form.postalCode, form.country);

  useEffect(() => {
    if (!shippingLoading && shipping.hasQuote && paymentMethod !== "BANK_TRANSFER") {
      setPaymentMethod("BANK_TRANSFER");
    }
  }, [shipping.hasQuote, shippingLoading, paymentMethod]);
  const subtotalHt = items.reduce((sum, item) => sum + item.unitPriceHT * item.quantity, 0);
  const kitoAdjustment = useKitoAdjustment(items);
  const kitoDiscountHT = kitoAdjustment?.discountHT || 0;
  const netSubtotalHt = Math.max(0, subtotalHt - kitoDiscountHT);
  const shippingHt = shipping.hasQuote ? 0 : shipping.confirmedAmountHT;
  const totalHt = netSubtotalHt + shippingHt;
  const totalTtc = totalHt * 1.2;
  function update(name: keyof typeof form, value: string) { setForm((current) => ({ ...current, [name]: value })); }
  function toggleBillingAddress(checked: boolean) {
    setUseBillingAddress(checked);
    if (!checked || !billingAddress) return;
    setForm((current) => ({
      ...current,
      company: billingAddress.company || customer.company || current.company,
      firstName: billingAddress.firstName || customer.firstName || current.firstName,
      lastName: billingAddress.lastName || customer.lastName || current.lastName,
      address1: billingAddress.address1 || "",
      address2: billingAddress.address2 || "",
      postalCode: billingAddress.postalCode || "",
      city: billingAddress.city || "",
      country: billingAddress.country || "FR",
    }));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (!items.length) { setError("Votre panier est vide."); return; }
    if (!paymentMethod) { setError("Choisissez un mode de paiement avant de continuer."); return; }
    setLoading(true);
    try {
      const endpoint = paymentMethod === "CARD" ? "/api/orders/stripe-checkout" : "/api/orders/bank-transfer";
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items, address: { company: form.company, firstName: form.firstName, lastName: form.lastName, address1: form.address1, address2: form.address2, postalCode: form.postalCode, city: form.city, country: form.country }, requestedDate: form.requestedDate, customerNote: form.customerNote }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Impossible d’enregistrer la commande.");
      if (paymentMethod === "CARD") {
        if (!result.checkoutUrl) throw new Error("Stripe n’a pas renvoyé de page de paiement.");
        window.location.assign(result.checkoutUrl);
        return;
      }
      sessionStorage.removeItem("oyste-checkout-postcode");
      clearCart();
      router.push(`/commande/confirmation/${result.id}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Une erreur est survenue."); }
    finally { setLoading(false); }
  }
  if (!items.length) return <div className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center shadow-sm"><CheckCircle2 className="mx-auto text-[#007f8f]" size={38}/><h2 className="mt-4 text-2xl font-black">Votre panier est vide</h2><Link href="/catalogue" className="mt-6 inline-flex rounded-xl bg-orange-600 px-6 py-3 text-sm font-black uppercase text-white">Retour au catalogue</Link></div>;
  return <form onSubmit={submit} className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_420px]">
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#007f8f]/10 text-[#007f8f]"><MapPin size={22}/></span><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#007f8f]">Livraison</p><h2 className="text-2xl font-black">Adresse de livraison</h2></div></div>{billingAddress ? <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3.5"><input type="checkbox" checked={useBillingAddress} onChange={(e)=>toggleBillingAddress(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#007f8f]"/><span><strong className="block text-sm text-slate-900">Utiliser mon adresse de facturation</strong><span className="mt-0.5 block text-xs font-medium text-slate-500">Les coordonnées enregistrées dans « Mon entreprise » seront reprises automatiquement.</span></span></label> : null}<div className="mt-6 grid gap-4 md:grid-cols-2">
        {[{n:"company",l:"Société"},{n:"firstName",l:"Prénom"},{n:"lastName",l:"Nom"},{n:"address1",l:"Adresse"},{n:"address2",l:"Complément d’adresse",optional:true},{n:"postalCode",l:"Code postal"},{n:"city",l:"Ville"}].map((field) => <label key={field.n} className={field.n === "address1" || field.n === "address2" ? "md:col-span-2" : ""}><span className="text-xs font-black uppercase tracking-wide text-slate-500">{field.l}</span><input required={!field.optional} value={form[field.n as keyof typeof form]} onChange={(e)=>update(field.n as keyof typeof form,e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none transition focus:border-[#007f8f] focus:bg-white" /></label>)}
      </div></section>
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8"><div className="flex items-center gap-3"><CalendarDays className="text-[#007f8f]"/><h2 className="text-xl font-black">Informations complémentaires</h2></div><div className="mt-5 grid gap-4"><label><span className="text-xs font-black uppercase tracking-wide text-slate-500">Date souhaitée <span className="normal-case font-medium">(facultatif)</span></span><input value={form.requestedDate} onChange={(e)=>update("requestedDate",e.target.value)} placeholder="Ex. semaine 38" className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-[#007f8f]" /></label><label><span className="text-xs font-black uppercase tracking-wide text-slate-500">Message pour notre équipe <span className="normal-case font-medium">(facultatif)</span></span><textarea value={form.customerNote} onChange={(e)=>update("customerNote",e.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-[#007f8f]" /></label></div></section>
      
    </div>
    <aside className="h-fit rounded-[2rem] bg-[#071827] p-6 text-white shadow-xl xl:sticky xl:top-28"><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">Récapitulatif</p><div className="mt-5 space-y-4">{items.map((item)=><div key={item.id} className="flex justify-between gap-4 border-b border-white/10 pb-4"><div><p className="text-sm font-black">{item.name}</p><p className="mt-1 text-xs text-slate-400">Qté {item.quantity}</p></div><strong className="text-sm">{formatCartPrice(item.unitPriceHT*item.quantity)}</strong></div>)}</div><div className="mt-5 space-y-3 text-sm"><div className="flex justify-between text-slate-300"><span>Sous-total HT</span><strong className="text-white">{formatCartPrice(subtotalHt)}</strong></div>{kitoDiscountHT > 0 && <div className="flex justify-between text-emerald-300"><span>{kitoAdjustment?.discountReason === "TRANSPORT" ? "Remise transport KITO" : "Remise regroupement KITO"} (-{kitoAdjustment?.discountPercent.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %)</span><strong>-{formatCartPrice(kitoDiscountHT)}</strong></div>}<div className="flex justify-between text-slate-300"><span>Livraison HT</span><strong className="text-white">{shipping.hasQuote ? "À confirmer" : formatCartPrice(shippingHt)}</strong></div><div className="border-t border-white/15 pt-4"><div className="flex items-end justify-between gap-4"><span className="font-black">Total HT</span><strong className="text-2xl text-cyan-300">{formatCartPrice(totalHt)}</strong></div><div className="mt-1 flex justify-between text-xs font-bold text-slate-400"><span>Total TTC</span><span>{formatCartPrice(totalTtc)}</span></div></div>{shipping.hasQuote && <p className="rounded-xl bg-orange-500/15 p-3 text-xs font-bold leading-5 text-orange-100">Le transport nécessite une étude. Ne réalisez aucun virement avant la confirmation définitive de notre équipe.</p>}</div><div className="mt-5"><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-300">Mode de paiement</p><div className="mt-3 grid grid-cols-2 gap-3"><button type="button" disabled={shipping.hasQuote || shippingLoading} onClick={()=>setPaymentMethod("CARD")} className={`rounded-xl border px-3 py-3 text-left transition ${paymentMethod === "CARD" ? "border-cyan-300 bg-cyan-300/10" : "border-white/15 bg-white/5"} disabled:cursor-not-allowed disabled:opacity-40`}><strong className="block text-sm">Carte</strong><span className="mt-1 block text-[11px] font-bold text-slate-400">Stripe</span></button><button type="button" onClick={()=>setPaymentMethod("BANK_TRANSFER")} className={`rounded-xl border px-3 py-3 text-left transition ${paymentMethod === "BANK_TRANSFER" ? "border-cyan-300 bg-cyan-300/10" : "border-white/15 bg-white/5"}`}><strong className="block text-sm">Virement</strong><span className="mt-1 block text-[11px] font-bold text-slate-400">{shipping.hasQuote ? "Disponible sur devis" : "Professionnel"}</span></button></div>{!shippingLoading && shipping.hasQuote ? <p className="mt-3 text-xs font-bold leading-5 text-orange-100">La carte sera disponible après confirmation du transport.</p> : null}</div>{error && <p className="mt-4 rounded-xl bg-red-500/15 p-3 text-sm font-bold text-red-100">{error}</p>}<button disabled={loading || shippingLoading || !paymentMethod} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-4 text-sm font-black uppercase text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60">{loading?<><Loader2 className="animate-spin" size={18}/>Enregistrement…</>:<>{paymentMethod === "CARD" ? "Payer avec Stripe" : paymentMethod === "BANK_TRANSFER" ? "Confirmer la commande" : "Choisir un mode de paiement"} <ShieldCheck size={18}/></>}</button><div className="mt-5 space-y-3 text-xs font-bold text-slate-300"><p className="flex items-start gap-2"><ShieldCheck size={16} className="mt-0.5 text-cyan-300"/>Paiement sécurisé et validation de la commande</p><p className="flex items-start gap-2"><Truck size={16} className="mt-0.5 text-cyan-300"/>Préparation après validation du règlement</p></div></aside>
  </form>;
}
