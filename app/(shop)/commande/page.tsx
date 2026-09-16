import { redirect } from "next/navigation";
import Container from "@/components/ui/Container";
import CheckoutBankTransfer from "@/components/cart/CheckoutBankTransfer";
import { getCurrentCustomer } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const metadata = { title: "Finaliser ma commande | OYSTE" };

export default async function CheckoutPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/connexion?redirect=/commande");

  const billingAddress = await (prisma.customerAddress as any).findFirst({
    where: { customerId: customer.id, type: "BILLING" },
    orderBy: { updatedAt: "desc" },
    select: {
      company: true,
      firstName: true,
      lastName: true,
      address1: true,
      address2: true,
      postalCode: true,
      city: true,
      country: true,
    },
  });

  return (
    <main className="bg-slate-50 text-slate-950">
      <Container className="py-12 md:py-16">
        <div className="mb-8">
          <p className="text-sm font-black uppercase tracking-[.25em] text-orange-600">Paiement professionnel</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">Finaliser votre commande</h1>
          <p className="mt-4 max-w-3xl text-base font-bold leading-7 text-slate-600">Vérifiez votre adresse de livraison, puis confirmez votre commande. Une référence OYSTE unique vous permettra d’identifier votre virement.</p>
        </div>
        <CheckoutBankTransfer customer={customer} billingAddress={billingAddress} />
      </Container>
    </main>
  );
}
