import { cn } from "@/lib/cn";
import { statusLabels, type ConfigurationStatus } from "@/lib/admin/mock-data";

const styles: Record<ConfigurationStatus, string> = {
  new: "border-orange-200 bg-orange-50 text-orange-700",
  qualifying: "border-sky-200 bg-sky-50 text-sky-700",
  "quote-preparation": "border-violet-200 bg-violet-50 text-violet-700",
  "quote-sent": "border-amber-200 bg-amber-50 text-amber-700",
  won: "border-emerald-200 bg-emerald-50 text-emerald-700",
  lost: "border-slate-200 bg-slate-100 text-slate-500",
};

export default function StatusBadge({ status }: { status: ConfigurationStatus }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em]", styles[status])}>{statusLabels[status]}</span>;
}
