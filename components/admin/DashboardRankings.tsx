import Link from "next/link";
import { ArrowRight, Award, Building2, Package, Shapes, ShoppingBag, Trophy } from "lucide-react";
import { formatAdminPrice } from "@/lib/admin/orders-data";
import type { DashboardCategoryRanking, DashboardCustomerRanking, DashboardProductRanking } from "@/lib/admin/dashboard-data";

function RankingShell({
  title,
  subtitle,
  icon: Icon,
  href,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_18px_55px_-42px_rgba(15,23,42,0.6)]">
      <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
            <Icon size={18} />
          </span>
          <div>
            <h2 className="text-sm font-black tracking-[-0.02em] text-slate-950">{title}</h2>
            <p className="mt-1 text-xs font-medium text-slate-400">{subtitle}</p>
          </div>
        </div>
        <Link href={href} className="group inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#007f8f]">
          Voir tout <ArrowRight size={13} className="transition group-hover:translate-x-0.5" />
        </Link>
      </header>
      {children}
    </section>
  );
}

function RankBadge({ rank }: { rank: number }) {
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black ${rank === 1 ? "bg-amber-100 text-amber-700" : rank === 2 ? "bg-slate-200 text-slate-700" : rank === 3 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"}`}>
      {rank}
    </span>
  );
}

function EmptyRanking({ label }: { label: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center">
      <Trophy size={24} className="text-slate-300" />
      <p className="mt-3 text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-xs text-slate-400">Les données apparaîtront dès les premières commandes payées.</p>
    </div>
  );
}

export default function DashboardRankings({
  products,
  customers,
  categories,
}: {
  products: DashboardProductRanking[];
  customers: DashboardCustomerRanking[];
  categories: DashboardCategoryRanking[];
}) {
  return (
    <section className="mt-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#007f8f]">Performance commerciale</p>
          <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-slate-950">Les meilleures performances OYSTE</h2>
        </div>
        <p className="text-xs font-semibold text-slate-400">Classements calculés sur les commandes encaissées</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <RankingShell title="Top produits" subtitle="Classés par chiffre d’affaires" icon={Package} href="/admin/catalogue">
          {products.length === 0 ? <EmptyRanking label="Aucun produit classé" /> : (
            <ol className="divide-y divide-slate-100">
              {products.map((product, index) => (
                <li key={product.id}>
                  <Link href={`/admin/catalogue/${product.id}`} className="group flex items-center gap-3 px-5 py-4 transition hover:bg-slate-50 sm:px-6">
                    <RankBadge rank={index + 1} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-900 group-hover:text-[#007f8f]">{product.name}</p>
                      <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-slate-400"><ShoppingBag size={12} /> {product.quantity} unité{product.quantity > 1 ? "s" : ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-950">{formatAdminPrice(product.revenueHt)}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">HT</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </RankingShell>

        <RankingShell title="Top clients" subtitle="Classés par chiffre d’affaires TTC" icon={Building2} href="/admin/clients">
          {customers.length === 0 ? <EmptyRanking label="Aucun client classé" /> : (
            <ol className="divide-y divide-slate-100">
              {customers.map((customer, index) => (
                <li key={customer.id}>
                  <Link href="/admin/clients" className="group flex items-center gap-3 px-5 py-4 transition hover:bg-slate-50 sm:px-6">
                    <RankBadge rank={index + 1} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-900 group-hover:text-[#007f8f]">{customer.company || customer.name}</p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-400">{customer.ordersCount} commande{customer.ordersCount > 1 ? "s" : ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-950">{formatAdminPrice(customer.revenueTtc)}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">TTC</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </RankingShell>

        <RankingShell title="Top catégories" subtitle="Familles les plus performantes" icon={Shapes} href="/admin/catalogue">
          {categories.length === 0 ? <EmptyRanking label="Aucune catégorie classée" /> : (
            <ol className="divide-y divide-slate-100">
              {categories.map((category, index) => (
                <li key={category.id} className="flex items-center gap-3 px-5 py-4 sm:px-6">
                  <RankBadge rank={index + 1} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-900">{category.name}</p>
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-slate-400"><Award size={12} /> {category.quantity} unité{category.quantity > 1 ? "s" : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-950">{formatAdminPrice(category.revenueHt)}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">HT</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </RankingShell>
      </div>
    </section>
  );
}
