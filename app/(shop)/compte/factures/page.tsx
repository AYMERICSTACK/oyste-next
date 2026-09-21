import { Download, FileText } from "lucide-react";
import { getCurrentCustomer } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const metadata = { title: "Mes factures | OYSTE" };
export default async function CustomerInvoicesPage() {
  const customer = (await getCurrentCustomer())!;
  const invoices = await prisma.invoice.findMany({ where: { customerId: customer.id, pdfData: { not: null }, publishedAt: { not: null } }, orderBy: { createdAt: "desc" }, select: { id: true, number: true, filename: true, size: true, createdAt: true, order: { select: { reference: true } } } });
  const fmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });
  return <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-6 py-6 md:px-8"><p className="text-xs font-black uppercase tracking-[.2em] text-[#007f8f]">Documents</p><h2 className="mt-2 text-2xl font-black">Mes factures</h2><p className="mt-2 text-sm text-slate-500">Retrouvez les factures définitives mises à disposition par notre service facturation.</p></div>{invoices.length === 0 ? <div className="px-6 py-20 text-center"><FileText size={32} className="mx-auto text-slate-300"/><h3 className="mt-4 font-black">Aucune facture disponible</h3><p className="mt-2 text-sm text-slate-500">Elles apparaîtront ici dès leur émission.</p></div> : <div className="divide-y divide-slate-100">{invoices.map((invoice)=><article key={invoice.id} className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between md:px-8"><div><p className="font-black text-slate-950">{invoice.number || invoice.filename}</p><p className="mt-1 text-xs text-slate-500">Commande {invoice.order.reference} · {fmt.format(invoice.createdAt)}</p></div><a href={`/api/account/invoices/${invoice.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#007f8f] px-4 py-3 text-xs font-black text-white"><Download size={15}/>Consulter / télécharger</a></article>)}</div>}</section>;
}
