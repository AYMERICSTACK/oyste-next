"use client";
import { FormEvent, useState } from "react";
import { Eye, EyeOff, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error || "Connexion impossible."); setLoading(false); return; }
    router.refresh();
  }
  return <main className="grid min-h-screen place-items-center bg-[#04111b] p-5 text-slate-950">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(0,127,143,.25),transparent_34%),radial-gradient(circle_at_85%_75%,rgba(249,115,22,.16),transparent_30%)]" />
    <section className="relative w-full max-w-md rounded-[2rem] border border-white/10 bg-white p-7 shadow-2xl md:p-9">
      <div className="flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-600 text-sm font-black text-white shadow-lg shadow-orange-600/20">OY</div><div><p className="text-xl font-black tracking-tight">OYSTE</p><p className="text-[10px] font-black uppercase tracking-[.23em] text-[#007f8f]">Centre de pilotage</p></div></div>
      <div className="mt-8"><div className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] text-[#007f8f]"><ShieldCheck size={14}/> Accès sécurisé</div><h1 className="mt-4 text-3xl font-black">Connexion administrateur</h1><p className="mt-2 text-sm leading-6 text-slate-500">Accédez au catalogue, aux commandes et aux contenus du site.</p></div>
      <form onSubmit={submit} className="mt-7 space-y-4">
        <label className="block text-xs font-black text-slate-600">Adresse e-mail<input name="email" type="email" autoComplete="username" required className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3.5 outline-none transition focus:border-[#007f8f] focus:ring-4 focus:ring-cyan-50" /></label>
        <label className="block text-xs font-black text-slate-600">Mot de passe<div className="relative mt-2"><input name="password" type={show ? "text" : "password"} autoComplete="current-password" required className="w-full rounded-xl border border-slate-200 px-4 py-3.5 pr-12 outline-none transition focus:border-[#007f8f] focus:ring-4 focus:ring-cyan-50"/><button type="button" onClick={() => setShow(!show)} aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-100">{show ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-xs font-bold text-red-700">{error}</p>}
        <button disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#007f8f] px-5 py-4 text-xs font-black uppercase tracking-wide text-white transition hover:bg-[#006b79] disabled:opacity-60">{loading ? <Loader2 className="animate-spin" size={18}/> : <LockKeyhole size={18}/>} {loading ? "Connexion…" : "Se connecter"}</button>
      </form>
      <p className="mt-6 text-center text-[11px] leading-5 text-slate-400">Accès réservé aux collaborateurs autorisés.</p>
    </section>
  </main>;
}
