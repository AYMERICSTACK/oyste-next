import { customerOrderStatus, type CustomerOrderStatus } from "@/lib/account/orders";

const tones: Record<string, string> = {
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  cyan: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  orange: "bg-orange-50 text-orange-700 ring-orange-200",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  red: "bg-red-50 text-red-700 ring-red-200",
};

export default function OrderStatusBadge({ status }: { status: CustomerOrderStatus }) {
  const value = customerOrderStatus[status];
  return <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide ring-1 ring-inset ${tones[value.tone]}`}>{value.label}</span>;
}
