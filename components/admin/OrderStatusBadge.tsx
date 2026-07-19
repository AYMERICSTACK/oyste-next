import { cn } from "@/lib/cn";
import { orderStatusLabels, type OrderStatus } from "@/lib/admin/orders-data";

const styles: Record<OrderStatus, string> = {
  "pending-payment": "border-amber-200 bg-amber-50 text-amber-700",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  engineering: "border-sky-200 bg-sky-50 text-sky-700",
  production: "border-violet-200 bg-violet-50 text-violet-700",
  "quality-control": "border-cyan-200 bg-cyan-50 text-cyan-700",
  "ready-to-ship": "border-orange-200 bg-orange-50 text-orange-700",
  shipped: "border-indigo-200 bg-indigo-50 text-indigo-700",
  completed: "border-slate-200 bg-slate-100 text-slate-600",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
};

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em]", styles[status])}>{orderStatusLabels[status]}</span>;
}
