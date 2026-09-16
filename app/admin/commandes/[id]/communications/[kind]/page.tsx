import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import {
  buildBankTransferOrderEmail,
  buildCardOrderConfirmationEmail,
  buildPaymentConfirmationEmail,
} from "@/lib/orders/order-email";
import OrderCommunicationPreview from "@/components/admin/OrderCommunicationPreview";

export const dynamic = "force-dynamic";

type Kind = "order" | "payment";

export default async function OrderCommunicationPreviewPage({
  params,
}: {
  params: Promise<{ id: string; kind: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== "ACTIVE") redirect("/admin");

  const { id, kind: rawKind } = await params;
  if (rawKind !== "order" && rawKind !== "payment") notFound();
  const kind = rawKind as Kind;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      items: {
        orderBy: { name: "asc" },
        select: {
          name: true,
          reference: true,
          quantity: true,
          totalHt: true,
        },
      },
    },
  });
  if (!order) notFound();

  const base = {
    reference: order.reference,
    firstName: order.customer.firstName,
    company: order.customer.company,
    totalTtc: Number(order.totalTtc),
    currency: order.currency,
  };

  let html: string;
  let title: string;
  let description: string;

  if (kind === "payment") {
    html = buildPaymentConfirmationEmail(base);
    title = "Confirmation de paiement";
    description = "Rendu exact de l’email envoyé au client lorsque le règlement est confirmé.";
  } else if (order.paymentMethod === "BANK_TRANSFER") {
    html = buildBankTransferOrderEmail({
      ...base,
      firstName: order.customer.firstName || "",
      company: order.customer.company || "Entreprise",
      requiresShippingConfirmation: /confirmer/i.test(order.deliveryMode || ""),
      items: order.items.map((item) => ({
        name: item.name,
        reference: item.reference,
        quantity: item.quantity,
        totalHt: Number(item.totalHt),
      })),
    });
    title = "Confirmation de commande";
    description = "Rendu exact de l’email de commande utilisé pour un paiement par virement.";
  } else {
    html = buildCardOrderConfirmationEmail(base);
    title = "Confirmation de commande";
    description = "Rendu exact de l’email de commande utilisé pour un paiement par carte.";
  }

  return (
    <main className="mx-auto w-full max-w-[1180px] p-4 md:p-8">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href={`/admin/commandes/${encodeURIComponent(order.id)}`}
            className="text-xs font-black text-slate-500 hover:text-slate-950"
          >
            ← Retour à la commande
          </Link>
          <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-orange-600">
            V2.12.1 · Prévisualisation sans envoi
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">{title}</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">{description}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-black text-emerald-800">
          Aucun email ne sera envoyé
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
        Commande <strong className="text-slate-950">{order.reference}</strong> · Client{" "}
        <strong className="text-slate-950">{order.customer.email}</strong>
      </div>

      <OrderCommunicationPreview html={html} />
    </main>
  );
}
