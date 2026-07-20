import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Clock3,
  Factory,
  PackageCheck,
  ShoppingCart,
  Truck,
  UserRoundPlus,
} from "lucide-react";
import { formatAdminPrice } from "@/lib/admin/orders-data";
import type { DashboardCustomerItem, DashboardOrderItem } from "@/lib/admin/dashboard-data";

const statusLabels: Record<string, string> = {
  PENDING_PAYMENT: "Paiement attendu",
  PAID: "À lancer",
  ENGINEERING: "En étude",
  PRODUCTION: "En fabrication",
  QUALITY_CONTROL: "Contrôle qualité",
  READY_TO_SHIP: "Prête à expédier",
  SHIPPED: "Expédiée",
  COMPLETED: "Terminée",
};

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-xs font-bold text-slate-400">{label}</div>;
}

function OrderRow({ order, showAge = false }: { order: DashboardOrderItem; showAge?: boolean }) {
  return (
    <Link href={`/admin/commandes/${order.id}`} className="group flex items-center justify-between gap-3 rounded-2xl border border-transparent px-3 py-3 transition hover:border-slate-200 hover:bg-slate-50">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-black text-slate-950">{order.reference}</p>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-slate-500">{statusLabels[order.status] ?? order.status}</span>
        </div>
        <p className="mt-1 truncate text-xs font-bold text-slate-600">{order.company}</p>
        <p className="mt-1 truncate text-[10px] text-slate-400">{order.customerName} · {showAge ? `${order.ageDays} j sans évolution` : dateFormatter.format(order.createdAt)}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs font-black text-slate-950">{formatAdminPrice(order.totalTtc)}</p>
        <ArrowRight size={14} className="ml-auto mt-2 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#007f8f]" />
      </div>
    </Link>
  );
}

function SectionHeader({ eyebrow, title, href, icon: Icon }: { eyebrow: string; title: string; href: string; icon: React.ComponentType<{ size?: number }>; }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white"><Icon size={18} /></div>
        <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-orange-600">{eyebrow}</p><h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">{title}</h2></div>
      </div>
      <Link href={href} className="mt-1 text-[10px] font-black uppercase tracking-wide text-[#006d79]">Voir tout</Link>
    </div>
  );
}

export default function DashboardOperations({ recentOrders, recentCustomers, pendingOrders, productionQueue, todayShipments }: {
  recentOrders: DashboardOrderItem[];
  recentCustomers: DashboardCustomerItem[];
  pendingOrders: DashboardOrderItem[];
  productionQueue: DashboardOrderItem[];
  todayShipments: DashboardOrderItem[];
}) {
  return (
    <section className="mt-7 space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <article className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <SectionHeader eyebrow="Activité récente" title="Dernières commandes" href="/admin/commandes" icon={ShoppingCart} />
          <div className="divide-y divide-slate-100">{recentOrders.length ? recentOrders.map((order) => <OrderRow key={order.id} order={order} />) : <EmptyState label="Aucune commande récente." />}</div>
        </article>

        <article className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <SectionHeader eyebrow="CRM" title="Derniers clients" href="/admin/clients" icon={UserRoundPlus} />
          <div className="space-y-2">{recentCustomers.length ? recentCustomers.map((customer) => (
            <div key={customer.id} className="flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-slate-50">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700"><Building2 size={17} /></div>
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-black text-slate-950">{customer.company}</p><p className="mt-1 truncate text-[10px] text-slate-500">{customer.name} · {customer.email}</p></div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-500">{customer.ordersCount} cmd.</span>
            </div>
          )) : <EmptyState label="Aucun nouveau client." />}</div>
        </article>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <article className="rounded-[1.6rem] border border-amber-200 bg-gradient-to-b from-amber-50/70 to-white p-5 shadow-sm">
          <SectionHeader eyebrow="À traiter" title="Commandes en attente" href="/admin/commandes" icon={Clock3} />
          <div className="divide-y divide-amber-100">{pendingOrders.length ? pendingOrders.map((order) => <OrderRow key={order.id} order={order} />) : <EmptyState label="Aucune commande en attente." />}</div>
        </article>

        <article className="rounded-[1.6rem] border border-violet-200 bg-gradient-to-b from-violet-50/70 to-white p-5 shadow-sm">
          <SectionHeader eyebrow="Atelier" title="Production à surveiller" href="/admin/production" icon={Factory} />
          <div className="divide-y divide-violet-100">{productionQueue.length ? productionQueue.map((order) => <OrderRow key={order.id} order={order} showAge />) : <EmptyState label="Aucun dossier actif en production." />}</div>
        </article>

        <article className="rounded-[1.6rem] border border-sky-200 bg-gradient-to-b from-sky-50/70 to-white p-5 shadow-sm">
          <SectionHeader eyebrow="Logistique" title="Expéditions du jour" href="/admin/expeditions" icon={Truck} />
          {todayShipments.length ? <div className="divide-y divide-sky-100">{todayShipments.map((order) => <OrderRow key={order.id} order={order} />)}</div> : (
            <div className="rounded-2xl border border-dashed border-sky-200 bg-white/70 px-4 py-8 text-center"><PackageCheck size={24} className="mx-auto text-sky-400" /><p className="mt-3 text-xs font-black text-slate-600">Aucune expédition enregistrée aujourd’hui.</p><p className="mt-1 text-[10px] text-slate-400">Les commandes prêtes ou expédiées apparaîtront ici.</p></div>
          )}
        </article>
      </div>
    </section>
  );
}
