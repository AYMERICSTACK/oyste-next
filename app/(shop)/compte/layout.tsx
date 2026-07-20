import { redirect } from "next/navigation";
import { BadgeCheck, Building2, Clock3, ShieldCheck } from "lucide-react";
import { getCurrentCustomer } from "@/lib/auth/session";
import AccountNavigation from "@/components/account/AccountNavigation";
import LogoutButton from "@/components/account/LogoutButton";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/connexion?redirect=/compte");

  const loginDate = customer.previousLoginAt ?? customer.lastLoginAt ?? customer.createdAt;
  const formattedLoginDate = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(loginDate);

  return <main className="min-h-[70vh] bg-slate-50 py-8 md:py-12">
    <div className="mx-auto w-full max-w-7xl px-4">
      <header className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#061923_0%,#082635_65%,#073342_100%)] px-6 py-7 text-white shadow-xl shadow-slate-950/10 md:px-9 md:py-9">
        <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute -bottom-24 right-36 h-56 w-56 rounded-full bg-orange-500/5 blur-3xl" />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.22em] text-cyan-300"><ShieldCheck size={16}/>Espace professionnel sécurisé</div>
            <h1 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">{customer.company}</h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-300"><Building2 size={15}/>SIRET {customer.siret}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-bold text-cyan-100"><BadgeCheck size={14}/>Compte vérifié</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200"><Building2 size={14}/>Client professionnel</span>
            </div>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center lg:flex-col lg:items-end">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
              <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[.16em] text-slate-400"><Clock3 size={14}/>Dernière connexion</p>
              <p className="mt-1 text-sm font-bold text-white">{formattedLoginDate}</p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="h-fit rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-24"><AccountNavigation /></aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  </main>;
}
