import Link from "next/link";
import { ExternalLink, Menu } from "lucide-react";
import AdminGlobalSearch from "@/components/admin/search/AdminGlobalSearch";
import AdminNotificationsCenter from "@/components/admin/AdminNotificationsCenter";

export default function AdminTopbar() {
  return (
    <header className="flex h-[76px] shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 md:px-7">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button type="button" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 lg:hidden"><Menu size={20} /></button>
        <div className="hidden md:block"><AdminGlobalSearch /></div>
        <div className="md:hidden"><AdminGlobalSearch /></div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link href="/configurateur" className="hidden items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-700 transition hover:border-slate-400 sm:flex">Voir la boutique <ExternalLink size={15} /></Link>
        <AdminNotificationsCenter />
      </div>
    </header>
  );
}
