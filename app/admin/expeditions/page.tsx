import Link from "next/link";
import { ArrowUpRight, MapPin, Truck } from "lucide-react";
import OrderStatusBadge from "@/components/admin/OrderStatusBadge";
import { orders } from "@/lib/admin/orders-data";

export default function ExpeditionsPage() {
  const shippingOrders = orders.filter((order) => ["ready-to-ship", "shipped"].includes(order.status));
  return <main className="mx-auto w-full max-w-[1500px] p-4 md:p-7 xl:p-9"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-600">Logistique</p><h1 className="mt-2 text-3xl font-black md:text-4xl">Expéditions</h1><p className="mt-2 text-sm text-slate-500">Préparez les enlèvements et suivez les commandes expédiées.</p></div><div className="mt-7 space-y-4">{shippingOrders.map((order) => <article key={order.id} className="grid gap-4 rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_1fr_auto] md:items-center"><div><div className="flex flex-wrap items-center gap-3"><h2 className="text-lg font-black">{order.reference}</h2><OrderStatusBadge status={order.status} /></div><p className="mt-2 text-sm font-bold text-slate-700">{order.customer.company} · {order.family}</p></div><div><p className="flex items-start gap-2 text-xs text-slate-500"><MapPin size={15} className="mt-0.5 shrink-0" />{order.delivery.address}</p><p className="mt-2 flex items-center gap-2 text-xs font-black text-slate-700"><Truck size={15} />{order.delivery.mode} · {order.delivery.requestedDate}</p></div><Link href={`/admin/commandes/${order.id}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-black text-white">Ouvrir <ArrowUpRight size={15} /></Link></article>)}</div></main>;
}
