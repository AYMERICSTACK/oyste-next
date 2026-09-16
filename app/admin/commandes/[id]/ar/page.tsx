import { notFound } from "next/navigation";
import Link from "next/link";
import { getLiveAdminOrder } from "@/lib/admin/live-orders";

export const dynamic = "force-dynamic";

function money(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

export default async function OrderAcknowledgementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getLiveAdminOrder(id);
  if (!order) notFound();

  return (
    <main className="mx-auto max-w-[1050px] bg-white p-6 text-slate-950 md:p-10 print:p-0">
      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <Link href={`/admin/commandes/${encodeURIComponent(order.id)}`} className="text-sm font-black text-slate-600">← Retour à la commande</Link>
        <button onClick={undefined} className="hidden" />
        <div className="text-xs font-bold text-slate-400">Utilisez Ctrl+P / Imprimer → PDF pour enregistrer l’AR.</div>
      </div>

      <section className="border-b-4 border-slate-950 pb-6">
        <div className="flex items-start justify-between gap-8">
          <div>
            <div className="text-3xl font-black tracking-tight">OYSTE</div>
            <div className="mt-1 text-xs font-black uppercase tracking-[0.2em] text-cyan-700">Accusé de réception de commande</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-black">Confirmation de commande n° {order.reference}</div>
            <div className="mt-1 text-xs text-slate-500">Édité le {new Intl.DateTimeFormat("fr-FR").format(new Date())}</div>
          </div>
        </div>
      </section>

      <section className="mt-7 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-5">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Client</div>
          <div className="mt-2 text-lg font-black">{order.customer.company}</div>
          <div className="mt-1 text-sm">{order.customer.name}</div>
          <div className="mt-1 text-sm text-slate-500">{order.customer.email}</div>
        </div>
        <div className="rounded-xl border border-slate-200 p-5">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Livraison</div>
          <div className="mt-2 text-sm font-bold">{order.delivery.address}</div>
          <div className="mt-2 text-sm text-slate-500">{order.delivery.mode}</div>
        </div>
      </section>

      <section className="mt-7 overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950 text-white">
            <tr><th className="p-3">Référence</th><th className="p-3">Désignation</th><th className="p-3 text-center">Qté</th><th className="p-3 text-right">PU HT</th><th className="p-3 text-right">Total HT</th></tr>
          </thead>
          <tbody>
            {(order.items || []).map((item) => (
              <tr key={item.id} className="border-t border-slate-200">
                <td className="p-3 font-bold">{item.reference || "—"}</td>
                <td className="p-3">{item.name}</td>
                <td className="p-3 text-center">{item.quantity}</td>
                <td className="p-3 text-right">{money(item.unitPriceHt)}</td>
                <td className="p-3 text-right font-bold">{money(item.totalHt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-7 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-5">
        <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Délai confirmé</div>
        <div className="mt-2 text-xl font-black text-emerald-950">{order.supplierAck?.confirmedLeadTime || "À confirmer"}</div>
        <div className="mt-2 text-xs font-semibold leading-5 text-emerald-900">
          Délai confirmé après réception de l’AR fournisseur
          {order.supplierAck?.supplierAckReference ? ` (${order.supplierAck.supplierAckReference})` : ""}.
          Les délais de transport restent distincts du délai de départ/fabrication sauf mention expresse.
        </div>
      </section>

      <section className="mt-7 ml-auto max-w-[360px] space-y-2 text-sm">
        <div className="flex justify-between"><span>Total HT</span><strong>{money(order.totalHt)}</strong></div>
        <div className="flex justify-between"><span>TVA</span><strong>{money(order.totalTtc-order.totalHt)}</strong></div>
        <div className="flex justify-between border-t-2 border-slate-950 pt-3 text-lg"><span className="font-black">Total TTC</span><strong>{money(order.totalTtc)}</strong></div>
      </section>
    </main>
  );
}
