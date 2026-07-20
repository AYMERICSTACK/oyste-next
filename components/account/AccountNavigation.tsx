"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutDashboard, Package } from "lucide-react";

const links = [
  { href: "/compte", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { href: "/compte/commandes", label: "Mes commandes", icon: Package },
  { href: "/compte/entreprise", label: "Mon entreprise", icon: Building2 },
];

export default function AccountNavigation() {
  const pathname = usePathname();
  return <nav className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
    {links.map(({ href, label, icon: Icon, exact }) => {
      const active = exact ? pathname === href : pathname.startsWith(href);
      const classes = `group flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black transition ${active ? "bg-[#007f8f] text-white shadow-lg shadow-cyan-950/10" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`;
      const content = <><Icon size={18}/><span>{label}</span></>;
      return <Link key={href} href={href} className={classes}>{content}</Link>;
    })}
  </nav>;
}
