import { Database, FileClock, Layers3, PackageSearch, RefreshCcw } from "lucide-react";
import { getErpDashboardData } from "@/lib/admin/erp-data";

export const dynamic = "force-dynamic";

const statusLabels = {
  COMPLETED: "Terminé",
  SKIPPED: "Inchangé",
  RUNNING: "En cours",
  FAILED: "Échec",
} as const;

const statusClasses = {
  COMPLETED: "bg-emerald-50 text-emerald-700",
  SKIPPED: "bg-slate-100 text-slate-600",
  RUNNING: "bg-amber-50 text-amber-700",
  FAILED: "bg-rose-50 text-rose-700",
} as const;

function formatDate(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(value);
}

export default async function ErpPage() {
  const data = await getErpDashboardData();
  const cards = [
    { icon: PackageSearch, value: data.counts.products, label: "Produits ERP actifs" },
    { icon: Layers3, value: data.counts.ouvrages, label: "Ouvrages actifs" },
    { icon: Database, value: data.counts.families, label: "Familles détectées" },
    { icon: FileClock, value: data.imports.length, label: "Imports historisés" },
  ];

  return <main className="mx-auto w-full max-w-[1600px] p-4 md:p-7 xl:p-9">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-600">Catalogue technique</p><h1 className="mt-2 text-3xl font-black md:text-4xl">Synchronisation ERP</h1><p className="mt-2 max-w-3xl text-sm text-slate-500">Le snapshot ERP est comparé à PostgreSQL par empreinte SHA-256. Seules les références nouvelles ou modifiées sont réécrites, les suppressions sont désactivées et chaque passage reste historisé.</p></div>
      <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-5 py-4 text-xs font-bold text-cyan-900"><div className="flex items-center gap-2"><RefreshCcw size={16} /> Commande de mise à jour</div><code className="mt-2 block rounded-lg bg-white px-3 py-2 text-[11px] text-slate-700">npm run erp:refresh</code></div>
    </div>

    <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ icon: Icon, value, label }) => <article key={label} className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm"><Icon size={20} className="text-[#007f8f]" /><p className="mt-4 text-3xl font-black">{value.toLocaleString("fr-FR")}</p><p className="mt-1 text-xs font-bold text-slate-500">{label}</p></article>)}</section>

    <section className="mt-7 overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-5"><h2 className="text-lg font-black">Historique des synchronisations</h2><p className="mt-1 text-xs text-slate-500">Les douze derniers passages du fichier ERP vers la base PostgreSQL.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-[0.14em] text-slate-400"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Source</th><th className="px-5 py-3">Statut</th><th className="px-5 py-3">Produits</th><th className="px-5 py-3">Ouvrages</th><th className="px-5 py-3">Familles</th><th className="px-5 py-3">Fin</th></tr></thead><tbody className="divide-y divide-slate-100">{data.imports.map((item) => <tr key={item.id} className="text-xs"><td className="px-5 py-4 font-bold text-slate-700">{formatDate(item.startedAt)}</td><td className="px-5 py-4 font-mono text-[11px] text-slate-500">{item.source}</td><td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide ${statusClasses[item.status]}`}>{statusLabels[item.status]}</span></td><td className="px-5 py-4 font-black">{item.stats?.products?.toLocaleString("fr-FR") ?? "—"}</td><td className="px-5 py-4 font-black">{item.stats?.ouvrages?.toLocaleString("fr-FR") ?? "—"}</td><td className="px-5 py-4 font-black">{item.stats?.families?.toLocaleString("fr-FR") ?? "—"}</td><td className="px-5 py-4 text-slate-500">{formatDate(item.completedAt)}</td></tr>)}{data.imports.length === 0 && <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">Aucune synchronisation enregistrée. Lancez d’abord <code>npm run erp:refresh</code>.</td></tr>}</tbody></table></div></section>
  </main>;
}
