"use client";
import { useState } from "react";
import { Check, Save } from "lucide-react";

type Props = { firstName: string; lastName: string; phone: string; jobTitle: string };
export default function ProfileForm(props: Props) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage("");
    const response = await fetch("/api/account/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) });
    const data = await response.json(); setMessage(response.ok ? "Vos informations ont bien été enregistrées." : data.error); setLoading(false);
  }
  const input = "mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#007f8f]";
  return <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-black text-slate-600">Prénom *<input name="firstName" required defaultValue={props.firstName} className={input} /></label><label className="text-xs font-black text-slate-600">Nom *<input name="lastName" required defaultValue={props.lastName} className={input} /></label><label className="text-xs font-black text-slate-600">Fonction<input name="jobTitle" defaultValue={props.jobTitle} className={input} /></label><label className="text-xs font-black text-slate-600">Téléphone *<input name="phone" required defaultValue={props.phone} className={input} /></label>{message && <p className="flex items-center gap-2 text-sm font-bold text-[#007f8f] sm:col-span-2"><Check size={17} />{message}</p>}<button disabled={loading} className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#007f8f] px-5 py-3 text-xs font-black text-white sm:col-span-2"><Save size={16} />{loading ? "Enregistrement…" : "Enregistrer"}</button></form>;
}
