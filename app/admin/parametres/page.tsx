import { Settings2 } from "lucide-react";
import SendcloudIntegrationCard from "@/components/admin/SendcloudIntegrationCard";
import StripeIntegrationCard from "@/components/admin/StripeIntegrationCard";
import { testSendcloudConnection } from "@/lib/integrations/sendcloud";
import { testStripeConnection } from "@/lib/integrations/stripe";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const [sendcloudStatus, stripeStatus] = await Promise.all([
    testSendcloudConnection(),
    testStripeConnection(),
  ]);

  return (
    <main className="mx-auto w-full max-w-[1500px] p-4 md:p-7 xl:p-9">
      <div className="flex items-start gap-4">
        <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
          <Settings2 size={22} />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-600">Configuration</p>
          <h1 className="mt-2 text-3xl font-black md:text-4xl">Paramètres & intégrations</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Contrôlez les connexions entre OYSTE et les services externes utilisés par l’exploitation.</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6">
        <StripeIntegrationCard initialStatus={stripeStatus} />
        <SendcloudIntegrationCard initialStatus={sendcloudStatus} />
      </div>
    </main>
  );
}
