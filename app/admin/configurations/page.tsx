import { Download, Plus } from "lucide-react";
import ConfigurationsTable from "@/components/admin/ConfigurationsTable";
import { configurations } from "@/lib/admin/mock-data";

export default function AdminConfigurationsPage() {
  return (
    <main className="mx-auto w-full max-w-[1600px] p-4 md:p-7 xl:p-9">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-600">Pilotage commercial</p><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">Configurations</h1><p className="mt-2 text-sm text-slate-500">Centralisez, qualifiez et transformez chaque demande issue du configurateur.</p></div>
        <div className="flex gap-2"><button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-700"><Download size={16} /> Exporter</button><button type="button" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-black text-white"><Plus size={16} /> Nouveau dossier</button></div>
      </div>
      <div className="mt-7"><ConfigurationsTable records={configurations} /></div>
    </main>
  );
}
