"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Boxes, Building2, DatabaseZap, Factory, FilePenLine, LayoutDashboard, LogOut, Settings, ShieldCheck, ShoppingCart, Truck, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";

const navigation = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { href: "/admin/commandes", label: "Commandes", icon: ShoppingCart },
  { href: "/admin/production", label: "Production", icon: Factory },
  { href: "/admin/expeditions", label: "Expéditions", icon: Truck },
  { href: "/admin/catalogue", label: "Catalogue", icon: Boxes },
  { href: "/admin/erp", label: "ERP Catalogue", icon: DatabaseZap },
  { href: "/admin/fournisseurs", label: "Fournisseurs", icon: Building2 },
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/contenus", label: "Contenus & pages", icon: FilePenLine },
  { href: "/admin/utilisateurs", label: "Administrateurs", icon: ShieldCheck },
  { href: "/admin/statistiques", label: "Statistiques", icon: BarChart3, disabled: true },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  return <aside className="hidden w-[270px] shrink-0 border-r border-white/10 bg-[#07131f] text-white lg:flex lg:flex-col">
    <div className="border-b border-white/10 px-6 py-6"><Link href="/admin" className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500 text-sm font-black shadow-[0_10px_30px_rgba(249,115,22,.28)]">OY</div><div><p className="text-lg font-black tracking-tight">OYSTE</p><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Centre de pilotage</p></div></Link></div>
    <nav className="flex-1 space-y-1 px-4 py-6"><p className="px-3 pb-2 text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Exploitation</p>{navigation.map((item) => { const active = item.exact ? pathname === item.href : pathname.startsWith(item.href); const Icon = item.icon; return item.disabled ? <div key={item.href} className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-white/32"><Icon size={19} /><span className="flex-1">{item.label}</span><span className="rounded-full bg-white/5 px-2 py-1 text-[8px] font-black uppercase tracking-wider">Bientôt</span></div> : <Link key={item.href} href={item.href} className={cn("flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition", active ? "bg-white text-slate-950 shadow-lg" : "text-white/65 hover:bg-white/7 hover:text-white")}><Icon size={19} />{item.label}</Link>; })}</nav>
    <div className="border-t border-white/10 p-4"><div className="rounded-2xl bg-white/6 p-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-black text-cyan-200">AD</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">Aymeric D.</p><p className="truncate text-[10px] text-white/45">Administrateur</p></div><Settings size={17} className="text-white/35" /></div></div><Link href="/" className="mt-2 flex items-center gap-3 rounded-xl px-3 py-3 text-xs font-bold text-white/45 transition hover:bg-white/5 hover:text-white"><LogOut size={17} /> Retour au site</Link></div>
  <div className="px-3 pb-4"><AdminLogoutButton /></div>
      </aside>;
}
