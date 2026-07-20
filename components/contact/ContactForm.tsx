"use client";

import { useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  LoaderCircle,
  Mail,
  MessageSquareText,
  Phone,
  UserRound,
} from "lucide-react";

type ContactFormState = {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  consent: boolean;
};

const initialState: ContactFormState = {
  firstName: "",
  lastName: "",
  company: "",
  email: "",
  phone: "",
  subject: "DEVIS",
  message: "",
  consent: false,
};

const subjects = [
  { value: "DEVIS", label: "Demande de devis" },
  { value: "CONSEIL", label: "Conseil produit" },
  { value: "CONFIGURATION", label: "Projet sur mesure" },
  { value: "COMMANDE", label: "Suivi de commande" },
  { value: "SAV", label: "Service après-vente" },
  { value: "COMMERCIAL", label: "Échange commercial" },
  { value: "AUTRE", label: "Autre demande" },
];

const inputClass =
  "mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#007f8f] focus:ring-4 focus:ring-[#007f8f]/10";

export default function ContactForm() {
  const [form, setForm] = useState<ContactFormState>(initialState);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [feedback, setFeedback] = useState("");

  function updateField<K extends keyof ContactFormState>(key: K, value: ContactFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (status !== "idle") {
      setStatus("idle");
      setFeedback("");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setFeedback("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message || "Une erreur est survenue lors de l’envoi.");
      }

      setStatus("success");
      setFeedback(result.message || "Votre demande a bien été envoyée.");
      setForm(initialState);
    } catch (error) {
      setStatus("error");
      setFeedback(error instanceof Error ? error.message : "Une erreur est survenue lors de l’envoi.");
    }
  }

  if (status === "success") {
    return (
      <div className="flex min-h-[650px] flex-col items-center justify-center rounded-[2rem] border border-emerald-200 bg-emerald-50/70 px-7 py-16 text-center sm:px-12">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xl shadow-emerald-600/20">
          <CheckCircle2 size={40} />
        </div>
        <p className="mt-8 text-sm font-black uppercase tracking-[0.28em] text-emerald-700">Demande transmise</p>
        <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
          Merci, notre équipe revient vers vous rapidement.
        </h2>
        <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">{feedback}</p>
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setFeedback("");
          }}
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3.5 text-sm font-black text-white transition hover:bg-slate-800"
        >
          Envoyer une autre demande
          <ArrowRight size={18} />
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/5 sm:p-8 lg:p-10">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.28em] text-orange-600">Votre demande</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Parlez-nous de votre projet.</h2>
        </div>
        <p className="text-sm font-semibold text-slate-500">Réponse sous 1 jour ouvré</p>
      </div>

      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-bold text-slate-700">
          Prénom <span className="text-orange-600">*</span>
          <span className="relative block">
            <UserRound className="pointer-events-none absolute left-4 top-1/2 mt-1 -translate-y-1/2 text-slate-400" size={18} />
            <input
              required
              autoComplete="given-name"
              value={form.firstName}
              onChange={(event) => updateField("firstName", event.target.value)}
              className={`${inputClass} pl-11`}
              placeholder="Votre prénom"
            />
          </span>
        </label>

        <label className="text-sm font-bold text-slate-700">
          Nom <span className="text-orange-600">*</span>
          <span className="relative block">
            <UserRound className="pointer-events-none absolute left-4 top-1/2 mt-1 -translate-y-1/2 text-slate-400" size={18} />
            <input
              required
              autoComplete="family-name"
              value={form.lastName}
              onChange={(event) => updateField("lastName", event.target.value)}
              className={`${inputClass} pl-11`}
              placeholder="Votre nom"
            />
          </span>
        </label>

        <label className="text-sm font-bold text-slate-700 sm:col-span-2">
          Société <span className="text-orange-600">*</span>
          <span className="relative block">
            <Building2 className="pointer-events-none absolute left-4 top-1/2 mt-1 -translate-y-1/2 text-slate-400" size={18} />
            <input
              required
              minLength={2}
              maxLength={120}
              autoComplete="organization"
              value={form.company}
              onChange={(event) => updateField("company", event.target.value)}
              className={`${inputClass} pl-11`}
              placeholder="Nom de votre entreprise"
            />
          </span>
          <span className="mt-2 block text-xs font-semibold leading-5 text-slate-500">
            OYSTE est exclusivement réservé aux professionnels.
          </span>
        </label>

        <label className="text-sm font-bold text-slate-700">
          E-mail professionnel <span className="text-orange-600">*</span>
          <span className="relative block">
            <Mail className="pointer-events-none absolute left-4 top-1/2 mt-1 -translate-y-1/2 text-slate-400" size={18} />
            <input
              required
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              className={`${inputClass} pl-11`}
              placeholder="nom@entreprise.fr"
            />
          </span>
        </label>

        <label className="text-sm font-bold text-slate-700">
          Téléphone
          <span className="relative block">
            <Phone className="pointer-events-none absolute left-4 top-1/2 mt-1 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              className={`${inputClass} pl-11`}
              placeholder="06 00 00 00 00"
            />
          </span>
        </label>

        <label className="text-sm font-bold text-slate-700 sm:col-span-2">
          Motif de la demande <span className="text-orange-600">*</span>
          <select
            required
            value={form.subject}
            onChange={(event) => updateField("subject", event.target.value)}
            className={inputClass}
          >
            {subjects.map((subject) => (
              <option key={subject.value} value={subject.value}>
                {subject.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-bold text-slate-700 sm:col-span-2">
          Votre message <span className="text-orange-600">*</span>
          <span className="relative block">
            <MessageSquareText className="pointer-events-none absolute left-4 top-6 text-slate-400" size={18} />
            <textarea
              required
              minLength={20}
              maxLength={3000}
              rows={7}
              value={form.message}
              onChange={(event) => updateField("message", event.target.value)}
              className={`${inputClass} resize-y pl-11`}
              placeholder="Décrivez votre besoin, les dimensions, la capacité souhaitée ou toute information utile…"
            />
          </span>
          <span className="mt-2 block text-right text-xs font-semibold text-slate-400">{form.message.length} / 3000</span>
        </label>
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
        <input
          required
          type="checkbox"
          checked={form.consent}
          onChange={(event) => updateField("consent", event.target.checked)}
          className="mt-1 h-4 w-4 accent-[#007f8f]"
        />
        <span>
          J’accepte que les informations saisies soient utilisées pour répondre à ma demande. <span className="font-black text-slate-950">*</span>
        </span>
      </label>

      {status === "error" && (
        <p role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {feedback}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-orange-600 px-7 py-4 text-sm font-black uppercase tracking-wide text-white shadow-xl shadow-orange-600/20 transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "loading" ? (
          <>
            <LoaderCircle className="animate-spin" size={20} />
            Envoi en cours
          </>
        ) : (
          <>
            Envoyer ma demande
            <ArrowRight size={20} />
          </>
        )}
      </button>
    </form>
  );
}
