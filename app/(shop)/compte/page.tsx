import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, CreditCard, Package, ShoppingBag } from "lucide-react";
import { getCurrentCustomer } from "@/lib/auth/session";
import { formatDate, formatMoney, getCustomerDashboard, type CustomerOrderStatus } from "@/lib/account/orders";
import OrderStatusBadge from "@/components/account/OrderStatusBadge";

export const metadata = { title: "Tableau de bord professionnel | OYSTE" };

export default async function AccountPage() {
  const customer = (await getCurrentCustomer())!;
  const dashboard = await getCustomerDashboard(customer.id);
  const stats = [
    { label: "Commandes", value: dashboard.totalOrders, detail: "depuis la création du compte", icon: ShoppingBag },
    { label: "En cours", value: dashboard.activeOrders, detail: "étude, fabrication ou livraison", icon: Clock3 },
    { label: "Paiements en attente", value: dashboard.pendingPayment, detail: "action éventuellement requise", icon: CreditCard },
    { label: "Terminées", value: dashboard.completedOrders, detail: "commandes intégralement livrées", icon: CheckCircle2 },
  ];

  return <div className="space-y-6">
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <p className="text-xs font-black uppercase tracking-[.2em] text-[#007f8f]">Vue d’ensemble</p>
      <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div><h2 className="text-2xl font-black tracking-tight text-slate-950 md:text-3xl">Bonjour {customer.firstName || ""}</h2><p className="mt-2 text-sm text-slate-500">Retrouvez ici l’activité commerciale et logistique de votre entreprise.</p></div>
        <div className="rounded-2xl bg-slate-50 px-5 py-3 text-right"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Volume total HT</p><p className="mt-1 text-xl font-black text-slate-950">{formatMoney(dashboard.totalHt)}</p><p className="mt-1 text-[10px] font-bold text-slate-400">TTC {formatMoney(dashboard.totalTtc)}</p></div>
      </div>
    </section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(({ label, value, detail, icon: Icon }) => <article key={label} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-50 text-[#007f8f]"><Icon size={20}/></span><span className="text-3xl font-black text-slate-950">{value}</span></div><h3 className="mt-5 text-sm font-black text-slate-900">{label}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></article>)}</section>

    <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 md:px-7"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#007f8f]">Activité récente</p><h2 className="mt-1 text-xl font-black text-slate-950">Dernières commandes</h2></div><Link href="/compte/commandes" className="inline-flex items-center gap-2 text-xs font-black text-[#007f8f] hover:underline">Tout afficher<ArrowRight size={15}/></Link></div>
      {dashboard.latestOrders.length === 0 ? <div className="px-6 py-16 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Package size={25}/></span><h3 className="mt-4 font-black text-slate-900">Aucune commande pour le moment</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Vos prochaines commandes apparaîtront ici dès leur enregistrement.</p><Link href="/catalogue" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#007f8f] px-5 py-3 text-xs font-black text-white">Découvrir le catalogue<ArrowRight size={15}/></Link></div> : <div className="divide-y divide-slate-100">{dashboard.latestOrders.map((order) => <Link key={order.id} href={`/compte/commandes/${order.id}`} className="grid gap-3 px-6 py-5 transition hover:bg-slate-50 md:grid-cols-[1fr_auto_auto] md:items-center md:px-7"><div><p className="font-black text-slate-950">{order.reference}</p><p className="mt-1 text-xs text-slate-500">{formatDate(order.createdAt)} · {order._count.items} article{order._count.items > 1 ? "s" : ""}</p></div><OrderStatusBadge status={order.status as CustomerOrderStatus}/><div className="font-black text-slate-950 md:min-w-28 md:text-right"><div><div className="font-black text-slate-950">{formatMoney(Number(order.totalTtc) - Number(order.taxAmount), order.currency)} HT</div><div className="mt-1 text-[10px] font-bold text-slate-400">TTC {formatMoney(order.totalTtc, order.currency)}</div></div></div></Link>)}</div>}
    </section>
  </div>;
}
