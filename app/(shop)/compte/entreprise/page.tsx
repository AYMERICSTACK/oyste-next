import { Building2, KeyRound, ShieldCheck } from "lucide-react";
import { getCurrentCustomer } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import CompanyProfileForm from "@/components/account/CompanyProfileForm";
import PasswordForm from "@/components/account/PasswordForm";

export const metadata = { title: "Mon entreprise | OYSTE" };

export default async function CompanyAccountPage() {
  const customer = (await getCurrentCustomer())!;
  const billingAddress = await (prisma.customerAddress as any).findFirst({
    where: { customerId: customer.id, type: "BILLING" },
    orderBy: { createdAt: "asc" },
    select: { address1: true, address2: true, postalCode: true, city: true, country: true },
  });

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-[#007f8f]"><Building2 size={23} /></span>
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-[#007f8f]">Compte professionnel</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Mon entreprise</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Mettez à jour les coordonnées utilisées par OYSTE pour vos échanges, vos commandes et vos documents commerciaux.</p>
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="mb-7 flex items-center gap-3 border-b border-slate-100 pb-5">
          <Building2 className="text-[#007f8f]" size={21} />
          <div><h3 className="font-black text-slate-950">Informations de l’entreprise</h3><p className="mt-1 text-xs text-slate-500">L’adresse e-mail est aussi votre identifiant de connexion.</p></div>
        </div>
        <CompanyProfileForm
          customer={{
            company: customer.company ?? "",
            siret: customer.siret ?? "",
            firstName: customer.firstName ?? "",
            lastName: customer.lastName ?? "",
            jobTitle: customer.jobTitle ?? "",
            phone: customer.phone ?? "",
            email: customer.email,
          }}
          address={{
            address1: billingAddress?.address1 ?? "",
            address2: billingAddress?.address2 ?? "",
            postalCode: billingAddress?.postalCode ?? "",
            city: billingAddress?.city ?? "",
            country: billingAddress?.country ?? "FR",
          }}
        />
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="mb-7 flex items-center gap-3 border-b border-slate-100 pb-5">
          <KeyRound className="text-[#007f8f]" size={21} />
          <div><h3 className="font-black text-slate-950">Sécurité du compte</h3><p className="mt-1 text-xs text-slate-500">Votre mot de passe actuel est requis pour confirmer la modification.</p></div>
        </div>
        <PasswordForm />
      </section>

      <div className="flex items-start gap-3 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4 text-sm leading-6 text-[#006d7a]">
        <ShieldCheck className="mt-0.5 shrink-0" size={19} />
        <p><strong>Le SIRET ne peut pas être modifié en ligne.</strong> Il identifie juridiquement votre entreprise. En cas de changement de structure, contactez l’équipe OYSTE afin que votre compte soit vérifié.</p>
      </div>
    </div>
  );
}
