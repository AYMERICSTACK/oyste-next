"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeEuro,
  Boxes,
  CircleDollarSign,
  CreditCard,
  Factory,
  RefreshCw,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import DashboardCharts from "@/components/admin/DashboardCharts";
import DashboardOperations from "@/components/admin/DashboardOperations";
import DashboardRankings from "@/components/admin/DashboardRankings";
import type { DashboardData, DashboardMetric, DashboardOrderItem, DashboardCustomerItem } from "@/lib/admin/dashboard-data";
import { formatAdminPrice } from "@/lib/admin/orders-data";

const REFRESH_INTERVAL = 30_000;
const numberFormatter = new Intl.NumberFormat("fr-FR");
const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

type MetricCardProps = {
  label: string;
  metric: DashboardMetric;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  format?: "number" | "currency";
  caption: string;
  href: string;
  accent: string;
};

type DashboardResponse = {
  dashboard: DashboardData;
  generatedAt: string;
};

function reviveDashboard(data: DashboardData): DashboardData {
  const reviveOrder = (order: DashboardOrderItem): DashboardOrderItem => ({
    ...order,
    createdAt: new Date(order.createdAt),
    updatedAt: new Date(order.updatedAt),
  });
  const reviveCustomer = (customer: DashboardCustomerItem): DashboardCustomerItem => ({
    ...customer,
    createdAt: new Date(customer.createdAt),
  });

  return {
    ...data,
    recentOrders: data.recentOrders.map(reviveOrder),
    recentCustomers: data.recentCustomers.map(reviveCustomer),
    pendingOrders: data.pendingOrders.map(reviveOrder),
    productionQueue: data.productionQueue.map(reviveOrder),
    todayShipments: data.todayShipments.map(reviveOrder),
  };
}

function MetricCard({ label, metric, icon: Icon, format = "number", caption, href, accent }: MetricCardProps) {
  const isPositive = metric.change >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;
  const value = format === "currency" ? formatAdminPrice(metric.value) : numberFormatter.format(metric.value);

  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-[0_16px_45px_-34px_rgba(15,23,42,0.5)] transition duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_22px_55px_-32px_rgba(15,23,42,0.45)]"
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${accent}`} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <p className="mt-3 text-[1.7rem] font-black tracking-[-0.04em] text-slate-950">{value}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/10 transition group-hover:scale-105">
          <Icon size={19} />
        </div>
      </div>
      <div className="mt-5 flex items-end justify-between gap-3 border-t border-slate-100 pt-4">
        <div>
          <div className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${isPositive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            <TrendIcon size={12} />
            {Math.abs(metric.change).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %
          </div>
          <p className="mt-2 text-[11px] font-semibold text-slate-400">{caption}</p>
        </div>
        <ArrowRight size={15} className="mb-1 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#007f8f]" />
      </div>
    </Link>
  );
}

export default function DashboardLive({ initialDashboard, initialGeneratedAt }: { initialDashboard: DashboardData; initialGeneratedAt: string }) {
  const [dashboard, setDashboard] = useState(() => reviveDashboard(initialDashboard));
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date(initialGeneratedAt));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const requestInFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setIsRefreshing(true);

    try {
      const response = await fetch("/api/admin/dashboard", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) throw new Error(`Dashboard indisponible (${response.status})`);

      const payload = (await response.json()) as DashboardResponse;
      setDashboard(reviveDashboard(payload.dashboard));
      setLastUpdatedAt(new Date(payload.generatedAt));
      setIsOnline(true);
    } catch {
      setIsOnline(false);
    } finally {
      requestInFlight.current = false;
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(refresh, REFRESH_INTERVAL);
    const handleFocus = () => void refresh();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const handleOnline = () => void refresh();
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refresh]);

  const metrics = useMemo<MetricCardProps[]>(() => [
    { label: "Chiffre d’affaires", metric: dashboard.revenue, icon: CircleDollarSign, format: "currency", caption: "vs mois précédent", href: "/admin/commandes", accent: "bg-emerald-500" },
    { label: "Commandes", metric: dashboard.orders, icon: ShoppingCart, caption: "créées ce mois", href: "/admin/commandes", accent: "bg-orange-500" },
    { label: "Clients", metric: dashboard.customers, icon: Users, caption: "nouveaux ce mois", href: "/admin/clients", accent: "bg-cyan-500" },
    { label: "Produits", metric: dashboard.products, icon: Boxes, caption: "ajoutés ce mois", href: "/admin/catalogue", accent: "bg-slate-700" },
    { label: "Production", metric: dashboard.production, icon: Factory, caption: "dossiers actifs", href: "/admin/production", accent: "bg-violet-500" },
    { label: "Expéditions", metric: dashboard.shipments, icon: Truck, caption: "traitées ce mois", href: "/admin/expeditions", accent: "bg-sky-500" },
    { label: "Paiements", metric: dashboard.payments, icon: CreditCard, caption: "encaissés ce mois", href: "/admin/commandes", accent: "bg-teal-500" },
    { label: "Panier moyen", metric: dashboard.averageOrder, icon: BadgeEuro, format: "currency", caption: "vs mois précédent", href: "/admin/commandes", accent: "bg-amber-500" },
  ], [dashboard]);

  return (
    <main className="mx-auto w-full max-w-[1600px] p-4 md:p-7 xl:p-9">
      <section className="relative overflow-hidden rounded-[2rem] bg-[#07131f] px-5 py-7 text-white shadow-[0_30px_80px_-45px_rgba(2,12,27,0.9)] sm:px-7 lg:px-9 lg:py-9">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Cockpit opérationnel</span>
              <span className="text-[11px] font-bold capitalize text-white/45">{dateFormatter.format(new Date())}</span>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${isOnline ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-rose-400/20 bg-rose-400/10 text-rose-300"}`}>
                {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                {isOnline ? "Temps réel" : "Hors ligne"}
              </span>
            </div>
            <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-[-0.04em] sm:text-4xl lg:text-5xl">Pilotez toute l’activité OYSTE depuis un seul écran.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/55">Commerce, paiements, production et logistique se mettent à jour automatiquement à partir de la base de données.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/40">À encaisser</p>
              <p className="mt-2 text-xl font-black text-orange-300">{formatAdminPrice(dashboard.pendingPaymentsAmount)}</p>
            </div>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={isRefreshing}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-xs font-black uppercase tracking-wide text-white transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw size={15} className={isRefreshing ? "animate-spin" : ""} />
              Actualiser
            </button>
            <Link href="/admin/commandes" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-xs font-black uppercase tracking-wide text-slate-950 transition hover:bg-cyan-100">Voir les commandes <ArrowRight size={15} /></Link>
          </div>
        </div>
        <div className="relative mt-5 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-white/35">
          <span>Dernière synchronisation : {timeFormatter.format(lastUpdatedAt)}</span>
          <span>•</span>
          <span>Actualisation automatique toutes les 30 secondes</span>
          {!isOnline && <span className="text-rose-300">• Les dernières données disponibles restent affichées</span>}
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </section>

      <DashboardCharts points={dashboard.chartPoints} />
      <DashboardOperations
        recentOrders={dashboard.recentOrders}
        recentCustomers={dashboard.recentCustomers}
        pendingOrders={dashboard.pendingOrders}
        productionQueue={dashboard.productionQueue}
        todayShipments={dashboard.todayShipments}
      />
      <DashboardRankings products={dashboard.topProducts} customers={dashboard.topCustomers} categories={dashboard.topCategories} />
    </main>
  );
}
