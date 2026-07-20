import { redirect } from "next/navigation";
import AuthForm from "@/components/account/AuthForm";
import { getCurrentCustomer } from "@/lib/auth/session";
export const metadata = { title: "Connexion professionnelle | OYSTE" };
export default async function LoginPage() { if (await getCurrentCustomer()) redirect("/compte"); return <main className="bg-slate-50 py-16 md:py-24"><div className="mx-auto grid w-full max-w-5xl gap-10 px-4 lg:grid-cols-2 lg:items-center"><section><p className="text-xs font-black uppercase tracking-[.25em] text-orange-600">Espace client B2B</p><h1 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">Retrouvez votre activité OYSTE.</h1><p className="mt-5 text-base leading-7 text-slate-600">Connectez-vous à votre espace professionnel pour gérer vos informations et préparer vos prochains projets.</p></section><AuthForm mode="login" /></div></main>; }
