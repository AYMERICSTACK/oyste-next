"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Filter, Search, SlidersHorizontal } from "lucide-react";
import type { ConfigurationRecord, ConfigurationStatus } from "@/lib/admin/mock-data";
import { formatAdminPrice, statusLabels } from "@/lib/admin/mock-data";
import StatusBadge from "./StatusBadge";

export default function ConfigurationsTable({ records, compact = false }: { records: ConfigurationRecord[]; compact?: boolean }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | ConfigurationStatus>("all");

  const filtered = useMemo(() => records.filter((record) => {
    const search = query.toLowerCase();
    const matchesQuery = !search || [record.reference, record.customer.name, record.customer.company, record.family].some((value) => value.toLowerCase().includes(search));
    return matchesQuery && (status === "all" || record.status === status);
  }), [query, records, status]);

  return (
    <div className="overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white shadow-sm">
      {!compact ? (
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center">
          <div className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <Search size={17} className="text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Référence, client, société, famille…" className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-slate-400" />
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3"><Filter size={16} className="text-slate-400" /><select value={status} onChange={(event) => setStatus(event.target.value as "all" | ConfigurationStatus)} className="bg-transparent py-2.5 text-xs font-black text-slate-700 outline-none"><option value="all">Tous les statuts</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500"><SlidersHorizontal size={17} /></button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead><tr className="border-b border-slate-200 bg-slate-50/80 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400"><th className="px-5 py-3.5">Dossier</th><th className="px-4 py-3.5">Client</th><th className="px-4 py-3.5">Solution</th><th className="px-4 py-3.5">Statut</th><th className="px-4 py-3.5">Responsable</th><th className="px-4 py-3.5 text-right">Montant HT</th><th className="w-14 px-4 py-3.5" /></tr></thead>
          <tbody>
            {filtered.map((record) => (
              <tr key={record.id} className="group border-b border-slate-100 transition last:border-0 hover:bg-slate-50/80">
                <td className="px-5 py-4"><Link href={`/admin/configurations/${record.id}`} className="font-black text-slate-950 hover:text-[#007f8f]">{record.reference}</Link><p className="mt-1 text-[10px] font-medium text-slate-400">{new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(record.createdAt))}</p></td>
                <td className="px-4 py-4"><p className="text-sm font-black text-slate-850">{record.customer.name}</p><p className="mt-1 text-xs text-slate-500">{record.customer.company}</p></td>
                <td className="px-4 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#007f8f]/10 text-[11px] font-black text-[#006d79]">{record.family}</span><div><p className="max-w-[190px] truncate text-xs font-black text-slate-800">{record.familyLabel}</p><p className="mt-1 text-[10px] text-slate-400">{record.capacity} · {record.reach}</p></div></div></td>
                <td className="px-4 py-4"><StatusBadge status={record.status} /></td>
                <td className="px-4 py-4 text-xs font-bold text-slate-600">{record.owner}</td>
                <td className="px-4 py-4 text-right text-sm font-black text-slate-950">{formatAdminPrice(record.totalHt)}</td>
                <td className="px-4 py-4"><Link href={`/admin/configurations/${record.id}`} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition group-hover:border-slate-900 group-hover:bg-slate-950 group-hover:text-white"><ArrowUpRight size={16} /></Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 ? <div className="p-10 text-center text-sm font-bold text-slate-400">Aucun dossier ne correspond aux filtres.</div> : null}
    </div>
  );
}
