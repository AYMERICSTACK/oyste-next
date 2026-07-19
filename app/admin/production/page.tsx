import Link from "next/link";
import { ArrowUpRight, Factory } from "lucide-react";
import OrderStatusBadge from "@/components/admin/OrderStatusBadge";
import { orders } from "@/lib/admin/orders-data";

export default function ProductionPage() {
  const productionOrders = orders.filter((order) =>
    ["engineering", "production", "quality-control"].includes(order.status),
  );

  return (
    <main className="mx-auto w-full max-w-[1600px] p-4 md:p-7 xl:p-9">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-600">Atelier & bureau d’études</p>
        <h1 className="mt-2 text-3xl font-black md:text-4xl">Production</h1>
        <p className="mt-2 text-sm text-slate-500">Les commandes à étudier, fabriquer et contrôler.</p>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        {productionOrders.map((order) => (
          <article key={order.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{order.reference}</p>
                <h2 className="mt-2 text-lg font-black">{order.customer.company}</h2>
              </div>
              <OrderStatusBadge status={order.status} />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {[
                ["Famille", order.family],
                ["Charge", order.capacity],
                ["Portée", order.reach],
                ["Hauteur", order.height],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[9px] font-black uppercase text-slate-400">{label}</p>
                  <p className="mt-1 text-sm font-black text-slate-800">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <div className="mb-2 flex justify-between text-[10px] font-black">
                <span className="text-slate-500">{order.productionOwner}</span>
                <span>{order.progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[#007f8f]" style={{ width: `${order.progress}%` }} />
              </div>
            </div>

            <Link href={`/admin/commandes/${order.id}`} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 py-3 text-xs font-black text-white">
              Ouvrir la fiche atelier <ArrowUpRight size={15} />
            </Link>
          </article>
        ))}
      </div>

      {productionOrders.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <Factory className="mx-auto text-slate-300" />
          <p className="mt-3 text-sm font-black text-slate-500">Aucune commande en production.</p>
        </div>
      ) : null}
    </main>
  );
}
