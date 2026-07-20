"use client";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
export default function AdminLogoutButton() {
  const router = useRouter();
  return <button onClick={async () => { await fetch("/api/admin/auth/logout", { method: "POST" }); router.refresh(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-black text-slate-400 transition hover:bg-white/5 hover:text-white"><LogOut size={17}/> Déconnexion</button>;
}
