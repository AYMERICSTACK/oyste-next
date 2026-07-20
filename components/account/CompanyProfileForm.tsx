"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Save, TriangleAlert } from "lucide-react";

type Props = {
  customer: { company: string; siret: string; firstName: string; lastName: string; jobTitle: string; phone: string; email: string };
  address: { address1: string; address2: string; postalCode: string; city: string; country: string };
};

export default function CompanyProfileForm({ customer, address }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Impossible d’enregistrer les modifications.");
      setFeedback({ type: "success", text: "Les informations de votre entreprise ont bien été mises à jour." });
      router.refresh();
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "Une erreur est survenue." });
    } finally {
      setLoading(false);
    }
  }

  const input = "mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-[#007f8f] focus:ring-4 focus:ring-cyan-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";
  const label = "text-xs font-black uppercase tracking-wide text-slate-600";

  return (
    <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
      <label className={`${label} sm:col-span-2`}>Société *<input name="company" required defaultValue={customer.company} autoComplete="organization" className={input} /></label>
      <label className={`${label} sm:col-span-2`}>SIRET<input value={customer.siret} disabled aria-describedby="siret-help" className={input} /><span id="siret-help" className="mt-2 block text-[11px] font-medium normal-case tracking-normal text-slate-400">Modification uniquement après vérification par l’équipe OYSTE.</span></label>
      <label className={label}>Prénom *<input name="firstName" required defaultValue={customer.firstName} autoComplete="given-name" className={input} /></label>
      <label className={label}>Nom *<input name="lastName" required defaultValue={customer.lastName} autoComplete="family-name" className={input} /></label>
      <label className={label}>Fonction<input name="jobTitle" defaultValue={customer.jobTitle} autoComplete="organization-title" className={input} /></label>
      <label className={label}>Téléphone *<input name="phone" required type="tel" defaultValue={customer.phone} autoComplete="tel" className={input} /></label>
      <label className={`${label} sm:col-span-2`}>Adresse e-mail de connexion *<input name="email" required type="email" defaultValue={customer.email} autoComplete="email" className={input} /></label>

      <div className="my-2 border-t border-slate-100 sm:col-span-2" />
      <div className="sm:col-span-2"><h4 className="font-black text-slate-950">Adresse professionnelle</h4><p className="mt-1 text-xs text-slate-500">Utilisée comme adresse de facturation par défaut.</p></div>
      <label className={`${label} sm:col-span-2`}>Adresse *<input name="address1" required defaultValue={address.address1} autoComplete="street-address" className={input} /></label>
      <label className={`${label} sm:col-span-2`}>Complément d’adresse<input name="address2" defaultValue={address.address2} className={input} /></label>
      <label className={label}>Code postal *<input name="postalCode" required defaultValue={address.postalCode} autoComplete="postal-code" className={input} /></label>
      <label className={label}>Ville *<input name="city" required defaultValue={address.city} autoComplete="address-level2" className={input} /></label>
      <label className={`${label} sm:col-span-2`}>Pays *<select name="country" required defaultValue={address.country} autoComplete="country" className={input}><option value="FR">France</option><option value="BE">Belgique</option><option value="CH">Suisse</option><option value="LU">Luxembourg</option><option value="DE">Allemagne</option><option value="IT">Italie</option><option value="ES">Espagne</option><option value="OTHER">Autre</option></select></label>

      {feedback && <div role="status" className={`flex items-start gap-2 rounded-2xl px-4 py-3 text-sm font-bold sm:col-span-2 ${feedback.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{feedback.type === "success" ? <CheckCircle2 className="mt-0.5 shrink-0" size={18} /> : <TriangleAlert className="mt-0.5 shrink-0" size={18} />}{feedback.text}</div>}
      <button disabled={loading} className="inline-flex w-fit items-center gap-2 rounded-2xl bg-[#007f8f] px-6 py-3.5 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-cyan-950/10 transition hover:bg-[#006d7a] disabled:cursor-wait disabled:opacity-60 sm:col-span-2"><Save size={17} />{loading ? "Enregistrement…" : "Enregistrer les modifications"}</button>
    </form>
  );
}
