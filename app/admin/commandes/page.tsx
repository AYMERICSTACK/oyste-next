import { Download, ShoppingCart } from "lucide-react";
import OrdersTable from "@/components/admin/OrdersTable";
import { orders } from "@/lib/admin/orders-data";

export default function AdminOrdersPage() {
  return <main className="mx-auto w-full max-w-[1600px] p-4 md:p-7 xl:p-9">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-600">E-commerce industriel</p><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">Commandes</h1><p className="mt-2 text-sm text-slate-500">Suivez chaque commande depuis le paiement jusqu’à la livraison.</p></div><button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-700"><Download size={16} /> Exporter les commandes</button></div>
    <div className="mt-7"><OrdersTable records={orders} /></div>
    <div className="mt-5 flex items-center gap-2 text-xs font-bold text-slate-400"><ShoppingCart size={14} /> Les prochaines commandes du site apparaîtront automatiquement ici.</div>
  </main>;
}
