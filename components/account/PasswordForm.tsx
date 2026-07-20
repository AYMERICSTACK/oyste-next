"use client";

import { useState } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, TriangleAlert } from "lucide-react";

export default function PasswordForm() {
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    if (values.newPassword !== values.passwordConfirmation) {
      setFeedback({ type: "error", text: "La confirmation ne correspond pas au nouveau mot de passe." });
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/account/password", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Impossible de modifier le mot de passe.");
      form.reset();
      setFeedback({ type: "success", text: "Votre mot de passe a bien été modifié." });
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "Une erreur est survenue." });
    } finally {
      setLoading(false);
    }
  }

  const input = "mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 pr-12 text-sm outline-none transition focus:border-[#007f8f] focus:ring-4 focus:ring-cyan-50";
  const label = "relative text-xs font-black uppercase tracking-wide text-slate-600";
  return <form onSubmit={submit} className="grid max-w-2xl gap-5">
    <label className={label}>Mot de passe actuel *<input name="currentPassword" required type={show ? "text" : "password"} autoComplete="current-password" className={input} /><button type="button" onClick={() => setShow((value) => !value)} className="absolute bottom-3.5 right-4 text-slate-400" aria-label="Afficher ou masquer les mots de passe">{show ? <EyeOff size={19} /> : <Eye size={19} />}</button></label>
    <label className={label}>Nouveau mot de passe *<input name="newPassword" required type={show ? "text" : "password"} autoComplete="new-password" className={input} /></label>
    <label className={label}>Confirmation du nouveau mot de passe *<input name="passwordConfirmation" required type={show ? "text" : "password"} autoComplete="new-password" className={input} /></label>
    <p className="text-xs leading-5 text-slate-500">Au moins 10 caractères, avec une majuscule, une minuscule et un chiffre. Le nouveau mot de passe doit être différent de l’ancien.</p>
    {feedback && <div role="status" className={`flex items-start gap-2 rounded-2xl px-4 py-3 text-sm font-bold ${feedback.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{feedback.type === "success" ? <CheckCircle2 className="mt-0.5 shrink-0" size={18} /> : <TriangleAlert className="mt-0.5 shrink-0" size={18} />}{feedback.text}</div>}
    <button disabled={loading} className="inline-flex w-fit items-center gap-2 rounded-2xl bg-slate-950 px-6 py-3.5 text-xs font-black uppercase tracking-wide text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"><KeyRound size={17} />{loading ? "Modification…" : "Modifier mon mot de passe"}</button>
  </form>;
}
