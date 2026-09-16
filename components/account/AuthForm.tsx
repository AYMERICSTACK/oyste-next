"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";

type Mode = "login" | "register";

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    if (mode === "register" && payload.password !== payload.passwordConfirmation) {
      setError("Les deux mots de passe ne correspondent pas.");
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(mode === "register" ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Une erreur est survenue.");
      const requestedRedirect = new URLSearchParams(window.location.search).get("redirect");
      const redirectTarget = requestedRedirect?.startsWith("/") && !requestedRedirect.startsWith("//")
        ? requestedRedirect
        : "/compte";
      router.push(redirectTarget);
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#007f8f] focus:ring-4 focus:ring-cyan-50";
  return (
    <form onSubmit={submit} className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-950/5 sm:p-7">
      <div className="flex items-center gap-3 rounded-2xl bg-cyan-50 p-4 text-sm font-bold text-[#006d7a]"><ShieldCheck size={20} /> Espace exclusivement réservé aux professionnels</div>
      {mode === "register" && <div className="mt-6">
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#007f8f]">Entreprise</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-black uppercase tracking-wide text-slate-600 sm:col-span-2">Raison sociale *<input name="company" required autoComplete="organization" className={inputClass} /></label>
              <label className="text-xs font-black uppercase tracking-wide text-slate-600 sm:col-span-2">SIRET *<input name="siret" required inputMode="numeric" maxLength={17} placeholder="14 chiffres" className={inputClass} /></label>
              <label className="text-xs font-black uppercase tracking-wide text-slate-600 sm:col-span-2">N° TVA intracommunautaire<input name="vatNumber" autoComplete="off" placeholder="Ex. FR12345678901" className={inputClass} /><span className="mt-1.5 block text-[11px] font-medium normal-case tracking-normal text-slate-400">À renseigner si votre entreprise dispose d’un numéro de TVA intracommunautaire.</span></label>
              <label className="text-xs font-black uppercase tracking-wide text-slate-600 sm:col-span-2">Adresse électronique de facturation<input name="electronicBillingAddress" autoComplete="off" placeholder="Identifiant déclaré dans l’Annuaire de la facturation électronique" className={inputClass} /><span className="mt-1.5 block text-[11px] font-medium normal-case tracking-normal text-slate-400">Identifiant de réception des factures électroniques déclaré dans l’Annuaire de la facturation électronique.</span></label>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-6 lg:border-t-0 lg:pt-0">
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#007f8f]">Adresse de facturation</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-black uppercase tracking-wide text-slate-600 sm:col-span-2">Adresse *<input name="address1" required autoComplete="street-address" className={inputClass} /></label>
              <label className="text-xs font-black uppercase tracking-wide text-slate-600 sm:col-span-2">Complément d’adresse<input name="address2" className={inputClass} /></label>
              <label className="text-xs font-black uppercase tracking-wide text-slate-600">Code postal *<input name="postalCode" required autoComplete="postal-code" className={inputClass} /></label>
              <label className="text-xs font-black uppercase tracking-wide text-slate-600">Ville *<input name="city" required autoComplete="address-level2" className={inputClass} /></label>
              <label className="text-xs font-black uppercase tracking-wide text-slate-600 sm:col-span-2">Pays *<select name="country" required defaultValue="FR" autoComplete="country" className={inputClass}><option value="FR">France</option><option value="BE">Belgique</option><option value="CH">Suisse</option><option value="LU">Luxembourg</option><option value="DE">Allemagne</option><option value="IT">Italie</option><option value="ES">Espagne</option><option value="OTHER">Autre</option></select></label>
            </div>
          </div>
        </div>
        <div className="mt-6 border-t border-slate-100 pt-6">
          <p className="text-xs font-black uppercase tracking-[.18em] text-[#007f8f]">Contact du compte</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-black uppercase tracking-wide text-slate-600">Prénom *<input name="firstName" required autoComplete="given-name" className={inputClass} /></label>
            <label className="text-xs font-black uppercase tracking-wide text-slate-600">Nom *<input name="lastName" required autoComplete="family-name" className={inputClass} /></label>
            <label className="text-xs font-black uppercase tracking-wide text-slate-600">Fonction<input name="jobTitle" autoComplete="organization-title" className={inputClass} /></label>
            <label className="text-xs font-black uppercase tracking-wide text-slate-600">Téléphone *<input name="phone" required type="tel" autoComplete="tel" className={inputClass} /></label>
          </div>
        </div>
      </div>}
      <div className={`${mode === "register" ? "mt-4 sm:grid-cols-2" : "mt-6"} grid gap-3`}>
        <label className={`text-xs font-black uppercase tracking-wide text-slate-600 ${mode === "register" ? "sm:col-span-2" : ""}`}>Adresse e-mail *<input name="email" required type="email" autoComplete="email" className={inputClass} /></label>
        <label className="relative text-xs font-black uppercase tracking-wide text-slate-600">Mot de passe *<input name="password" required type={showPassword ? "text" : "password"} autoComplete={mode === "register" ? "new-password" : "current-password"} className={`${inputClass} pr-12`} /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute bottom-3.5 right-4 text-slate-400" aria-label="Afficher ou masquer le mot de passe">{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></label>
        {mode === "register" && <><label className="text-xs font-black uppercase tracking-wide text-slate-600">Confirmation du mot de passe *<input name="passwordConfirmation" required type={showPassword ? "text" : "password"} autoComplete="new-password" className={inputClass} /></label><p className="text-xs leading-5 text-slate-500 sm:col-span-2">10 caractères minimum, avec une majuscule, une minuscule et un chiffre.</p></>}
      </div>
      {error && <p role="alert" className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}
      <button disabled={loading} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-5 py-4 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-orange-600/20 transition hover:bg-orange-700 disabled:cursor-wait disabled:opacity-60">{loading ? "Veuillez patienter…" : mode === "register" ? "Créer mon compte professionnel" : "Me connecter"}<ArrowRight size={18} /></button>
      <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500">{mode === "register" ? <Building2 size={17} /> : <LockKeyhole size={17} />}<a className="font-black text-[#007f8f] hover:underline" href={mode === "register" ? "/connexion" : "/inscription"}>{mode === "register" ? "J’ai déjà un compte" : "Créer un compte professionnel"}</a></div>
    </form>
  );
}
