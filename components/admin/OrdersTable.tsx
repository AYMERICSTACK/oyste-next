"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, CreditCard, Filter, Search } from "lucide-react";
import OrderStatusBadge from "./OrderStatusBadge";
import { formatAdminPrice, orderStatusLabels, paymentStatusLabels, type OrderRecord, type OrderStatus } from "@/lib/admin/orders-data";

export default function OrdersTable({ records, compact = false }: { records: OrderRecord[]; compact?: boolean }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | OrderStatus>("all");
  const filtered = useMemo(() => records.filter((order) => {
    const search = query.toLowerCase();
    const matches = !search || [order.reference, order.customer.name, order.customer.company, order.family].some((value) => value.toLowerCase().includes(search));
    return matches && (status === "all" || order.status === status);
  }), [query, records, status]);

  return (
    <div className="overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white shadow-sm">
      {!compact ? <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center">
        <div className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><Search size={17} className="text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Commande, client, société, famille…" className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-slate-400" /></div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3"><Filter size={16} className="text-slate-400" /><select value={status} onChange={(event) => setStatus(event.target.value as "all" | OrderStatus)} className="bg-transparent py-2.5 text-xs font-black text-slate-700 outline-none"><option value="all">Tous les statuts</option>{Object.entries(orderStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      </div> : null}
      <div className="overflow-x-auto"><table className="w-full min-w-[980px] border-collapse text-left">
        <thead><tr className="border-b border-slate-200 bg-slate-50/80 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400"><th className="px-5 py-3.5">Commande</th><th className="px-4 py-3.5">Client</th><th className="px-4 py-3.5">Produit</th><th className="px-4 py-3.5">Paiement</th><th className="px-4 py-3.5">Statut</th><th className="px-4 py-3.5">Suivi</th><th className="px-4 py-3.5 text-right">Total TTC</th><th className="w-14 px-4 py-3.5" /></tr></thead>
        <tbody>{filtered.map((order) => <tr key={order.id} className="group border-b border-slate-100 transition last:border-0 hover:bg-slate-50/80">
          <td className="px-5 py-4"><Link href={`/admin/commandes/${order.id}`} className="font-black text-slate-950 hover:text-[#007f8f]">{order.reference}</Link><p className="mt-1 text-[10px] text-slate-400">{new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(order.createdAt))}</p></td>
          <td className="px-4 py-4"><p className="text-sm font-black text-slate-850">{order.customer.name}</p><p className="mt-1 text-xs text-slate-500">{order.customer.company}</p></td>
          <td className="px-4 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#007f8f]/10 text-[11px] font-black text-[#006d79]">{order.family}</span><div><p className="max-w-[190px] truncate text-xs font-black text-slate-800">{order.familyLabel}</p><p className="mt-1 text-[10px] text-slate-400">{order.capacity} · {order.reach}</p></div></div></td>
          <td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 text-xs font-black ${order.paymentStatus === "paid" ? "text-emerald-700" : "text-amber-700"}`}><CreditCard size={14} />{paymentStatusLabels[order.paymentStatus]}</span></td>
          <td className="px-4 py-4"><OrderStatusBadge status={order.status} /></td>
          <td className="px-4 py-4"><div className="w-28"><div className="mb-1 flex justify-between text-[9px] font-black text-slate-400"><span>{order.productionOwner}</span><span>{order.progress}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#007f8f]" style={{ width: `${order.progress}%` }} /></div></div></td>
          <td className="px-4 py-4 text-right text-sm font-black text-slate-950">{formatAdminPrice(order.totalTtc)}</td>
          <td className="px-4 py-4"><Link href={`/admin/commandes/${order.id}`} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition group-hover:border-slate-900 group-hover:bg-slate-950 group-hover:text-white"><ArrowUpRight size={16} /></Link></td>
        </tr>)}</tbody>
      </table></div>
      {filtered.length === 0 ? <div className="p-10 text-center text-sm font-bold text-slate-400">Aucune commande ne correspond aux filtres.</div> : null}
    </div>
  );
}
